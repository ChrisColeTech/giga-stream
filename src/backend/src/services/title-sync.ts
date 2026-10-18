import { AppError, ERRORS } from "../constants/errors.js";
import type { Store } from "../store/store.js";
import { type Actor, type AuditService } from "./audit-service.js";
import { type OmdbClient } from "./omdb-client.js";
import { type TitleDeleted } from "./title-deleted.js";
import { describeRequest } from "./title-sync-request.js";
import { type TmdbClient } from "./tmdb-client.js";
import {
  type Kind,
  type SyncRequest,
  DEFAULT_DISCOVER_PAGES,
  DEFAULT_SYNC_PAGES,
  KINDS,
  MAX_DISCOVER_PAGES,
  MAX_SYNC_PAGES,
  TITLE_FRESH_MS,
  asRecord,
  listOf,
  num,
  parseTitleId,
  rowOf,
  storedRowOf,
} from "./title-shapes.js";

/** What one finished run reports: the sentence (`ok` or why it failed) and how many titles it pulled. */
export interface SyncResult {
  outcome: string;
  titles: number;
}

/** An in-flight sync, kept in memory for the status and the single-flight rule. */
interface Running {
  startedAt: number;
  request: SyncRequest;
}

/**
 * The catalog sync (docs/03 section 7.6b): single-flight and audited; its outcome is read from the status. Nothing
 * here owns a timer: a catalog job (`job-runner.ts`) asks for a run, and the backend's one scheduler decides when.
 */
export function createTitleSync(deps: {
  store: Store;
  audit: AuditService;
  tmdb: TmdbClient;
  omdb: OmdbClient;
  deleted: TitleDeleted;
  now: () => number;
  /** A full-detail fetch for the explicit-ids scope. */
  ensureTitle: (kind: Kind, tmdbId: number, force?: boolean) => Promise<Record<string, unknown>>;
}) {
  const { store, audit, tmdb, omdb, now } = deps;

  let running: Running | null = null;
  let lastRun: { finishedAt: number; outcome: string } | null = null;
  let stopped = false;

  function listPage(kind: Kind, source: "trending" | "popular", page: number) {
    const path = source === "trending" ? `/trending/${kind}/week` : `/${kind}/popular`;
    return tmdb.get<Record<string, unknown>>(path, { page });
  }

  /** One discover page by popularity: the library fill's source (`03` section 7.6b). */
  function discoverPage(kind: Kind, page: number) {
    return tmdb.get<Record<string, unknown>>(`/discover/${kind}`, { sort_by: "popularity.desc", page });
  }

  /** One list row into the store: the shaped payload unless a fresh stored one stands; the popularity always. */
  function storeRow(kind: Kind, record: Record<string, unknown>): boolean {
    const id = num(record.id);
    if (id === undefined || deps.deleted.isDeleted(kind, id)) return false;
    const shaped = rowOf(kind, record, now());
    if (shaped === undefined) return false;
    const existing = store.titles.find(kind, id);
    const fresh = existing !== undefined && now() - existing.fetchedAt < TITLE_FRESH_MS
      && storedRowOf(kind, id, existing.payload, existing.popularityReadAt ?? existing.fetchedAt) !== undefined;
    const popularity = num(record.popularity);
    store.titles.put({
      kind,
      tmdbId: id,
      payload: fresh ? asRecord(existing.payload) : shaped,
      popularityScore: popularity ?? existing?.popularityScore ?? null,
      popularityReadAt: popularity !== undefined || popularity === null ? now() : existing?.popularityReadAt ?? null,
      fetchedAt: fresh ? existing.fetchedAt : now(),
    });
    return true;
  }

  async function runSync(request: SyncRequest): Promise<number> {
    let pulled = 0;
    if (request.scope === "titles") {
      for (const titleId of request.ids ?? []) {
        if (stopped) return pulled;
        const [kind, id] = parseTitleId(titleId);
        if (deps.deleted.isDeleted(kind, id)) continue; // deleted stays deleted until it is restored
        await deps.ensureTitle(kind, id);
        pulled += 1;
      }
    } else if (request.scope === "discover") {
      // The library fill (03 section 7.6b): one run walks both kinds, each capped at `pages`.
      const pages = Math.min(request.pages ?? DEFAULT_DISCOVER_PAGES, MAX_DISCOVER_PAGES);
      for (const kind of KINDS) {
        for (let page = 1; page <= pages; page++) {
          if (stopped) return pulled;
          const answer = asRecord(await discoverPage(kind, page));
          if (stopped) return pulled;
          for (const row of listOf(answer.results)) {
            if (stopped) return pulled;
            if (storeRow(kind, asRecord(row))) pulled += 1;
          }
        }
      }
    } else {
      const kind = request.kind ?? "movie";
      const pages = Math.min(request.pages ?? DEFAULT_SYNC_PAGES, MAX_SYNC_PAGES);
      for (let page = 1; page <= pages; page++) {
        if (stopped) return pulled;
        const answer = asRecord(await listPage(kind, request.scope, page));
        if (stopped) return pulled;
        for (const row of listOf(answer.results)) {
          if (stopped) return pulled;
          if (storeRow(kind, asRecord(row))) pulled += 1;
        }
      }
    }
    return pulled;
  }

  function recordSyncAudit(action: "sync.started" | "sync.finished" | "sync.failed", actor: Actor, detail: Record<string, unknown>): void {
    if (stopped) return; // shutting down: the store may already be closed
    try {
      audit.record(actor, { action, subject: "titles", detail });
    } catch {
      // a shutdown between the guard and the write; the entry is lost, not the process
    }
  }

  /** One observed sync run: audited started/finished/failed, the outcome kept, the slot released. */
  async function syncOnce(request: SyncRequest, actor: Actor, triggered: "admin" | "system"): Promise<SyncResult> {
    const detail = triggered === "system" ? { ...describeRequest(request), triggered } : describeRequest(request);
    recordSyncAudit("sync.started", actor, detail);
    let result: SyncResult;
    try {
      const titles = await runSync(request);
      recordSyncAudit("sync.finished", actor, { ...detail, titles });
      result = { outcome: "ok", titles };
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : "failed";
      recordSyncAudit("sync.failed", actor, { ...detail, reason });
      result = { outcome: reason, titles: 0 };
    } finally {
      running = null;
    }
    if (!stopped) lastRun = { finishedAt: now(), outcome: result.outcome };
    return result;
  }

  function claim(request: SyncRequest): void {
    if (running !== null) throw new AppError(ERRORS.syncBusy, { startedAt: running.startedAt });
    running = { startedAt: now(), request };
  }

  return {
    isRunning: (): boolean => running !== null,

    /** Start a sync and return at once (docs/03 section 7.6b). Single flight; `409 sync.busy` when one runs. */
    startSync(request: SyncRequest, actor: Actor): void {
      claim(request);
      void syncOnce(request, actor, "admin");
    },

    /** Run a sync and wait for it: the scheduler's run and a catalog job's. Single flight like `startSync`. */
    runNow(request: SyncRequest, actor: Actor, triggered: "admin" | "system"): Promise<SyncResult> {
      claim(request);
      return syncOnce(request, actor, triggered);
    },

    status() {
      const { total, stale } = store.titles.counts(TITLE_FRESH_MS);
      return {
        running: running !== null,
        ...(running !== null && { startedAt: running.startedAt }),
        ...(lastRun !== null && { lastRunAt: lastRun.finishedAt, lastOutcome: lastRun.outcome }),
        titles: total,
        stale,
        omdb: omdb.quota(),
      };
    },

    /** Shutdown: the run in flight stops between pages and leaves the store alone. */
    stop(): void {
      stopped = true;
    },
  };
}
