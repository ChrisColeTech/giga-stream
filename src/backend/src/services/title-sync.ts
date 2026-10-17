import { AppError, ERRORS } from "../constants/errors.js";
import type { Store } from "../store/store.js";
import { type Actor, type AuditService } from "./audit-service.js";
import { type OmdbClient } from "./omdb-client.js";
import { type TmdbClient } from "./tmdb-client.js";
import {
  type Kind,
  KINDS,
  type SyncRequest,
  DEFAULT_SYNC_PAGES,
  MAX_SYNC_PAGES,
  TITLE_FRESH_MS,
  asRecord,
  formatSchedule,
  listOf,
  num,
} from "./title-shapes.js";

/** An in-flight or most recent sync, kept in memory for the status and the single-flight rule. */
interface Job {
  startedAt: number;
  request: SyncRequest;
  triggered: "admin" | "system";
}

/** The catalog-sync job (docs/03 section 7.6b): single-flight and audited; its outcome is read from the status. */
export function createTitleSync(deps: {
  store: Store;
  audit: AuditService;
  tmdb: TmdbClient;
  omdb: OmdbClient;
  now: () => number;
  /** A full-detail fetch for the explicit-ids scope. */
  ensureTitle: (kind: Kind, tmdbId: number, force?: boolean) => Promise<Record<string, unknown>>;
}) {
  const { store, audit, tmdb, omdb, now } = deps;

  let running: Job | null = null;
  let lastRun: { finishedAt: number; outcome: string; titles: number; triggered: "admin" | "system" } | null = null;
  let scheduleTimer: ReturnType<typeof setTimeout> | undefined;
  let scheduleMs: number | undefined;
  let scheduledChain: Promise<void> = Promise.resolve();
  let stopped = false;

  function listPage(kind: Kind, source: "trending" | "popular", page: number) {
    const path = source === "trending" ? `/trending/${kind}/week` : `/${kind}/popular`;
    return tmdb.get<Record<string, unknown>>(path, { page });
  }

  async function runSync(request: SyncRequest, triggered: "admin" | "system"): Promise<number> {
    let pulled = 0;
    if (request.scope === "titles") {
      for (const id of request.ids ?? []) {
        if (stopped) return pulled;
        await deps.ensureTitle("movie", id);
        pulled += 1;
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
          const record = asRecord(row);
          const id = num(record.id);
          if (id === undefined) continue;
          const existing = store.titles.find(kind, id);
          const fresh = existing !== undefined && now() - existing.fetchedAt < TITLE_FRESH_MS;
          const popularity = num(record.popularity);
          store.titles.put({
            kind,
            tmdbId: id,
            payload: fresh ? asRecord(existing.payload) : record,
            popularityScore: popularity ?? existing?.popularityScore ?? null,
            popularityReadAt: popularity !== undefined || popularity === null ? now() : existing?.popularityReadAt ?? null,
            fetchedAt: fresh ? existing.fetchedAt : now(),
          });
          pulled += 1;
        }
      }
    }
    if (stopped) return pulled; // the store may already be closed at shutdown
    lastRun = { finishedAt: now(), outcome: "ok", titles: pulled, triggered };
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

  function describeRequest(request: SyncRequest): Record<string, unknown> {
    return request.scope === "titles"
      ? { scope: "titles", ids: (request.ids ?? []).length }
      : { scope: request.scope, kind: request.kind, pages: request.pages };
  }

  /** One observed sync run: audited started/finished/failed, the outcome kept, the slot released. */
  async function syncOnce(request: SyncRequest, actor: Actor, triggered: "admin" | "system"): Promise<void> {
    const detail = triggered === "system" ? { ...describeRequest(request), triggered } : describeRequest(request);
    recordSyncAudit("sync.started", actor, detail);
    try {
      const titles = await runSync(request, triggered);
      recordSyncAudit("sync.finished", actor, { ...detail, titles });
    } catch (error: unknown) {
      recordSyncAudit("sync.failed", actor, {
        ...detail,
        reason: error instanceof Error ? error.message : "failed",
      });
      lastRun = {
        finishedAt: now(),
        outcome: error instanceof Error ? error.message : "failed",
        titles: 0,
        triggered,
      };
    } finally {
      running = null;
    }
  }

  return {
    /** Start a bulk sync (docs/03 section 7.6b). Single flight; `409 sync.busy` when one runs. */
    startSync(request: SyncRequest, actor: Actor): void {
      if (running !== null) throw new AppError(ERRORS.syncBusy, { startedAt: running.startedAt });
      running = { startedAt: now(), request, triggered: "admin" };
      void syncOnce(request, actor, "admin");
    },

    status() {
      const { total, stale } = store.titles.counts(TITLE_FRESH_MS);
      return {
        running: running !== null,
        ...(running !== null && { startedAt: running.startedAt }),
        ...(lastRun !== null && { lastRunAt: lastRun.finishedAt, lastOutcome: lastRun.outcome }),
        titles: total,
        stale,
        schedule: formatSchedule(scheduleMs),
        omdb: omdb.quota(),
      };
    },

    /**
     * Arm the schedule hook (`TMDB_SYNC_SCHEDULE`): the system's only timer (`01` section 4.4). The
     * warm-up walks trending and popular for both kinds, `DEFAULT_SYNC_PAGES` each.
     */
    armSchedule(intervalMs: number): void {
      this.clearSchedule();
      stopped = false;
      scheduleMs = intervalMs;
      const warmup: SyncRequest[] = KINDS.flatMap((kind) => [
        { scope: "trending" as const, kind, pages: DEFAULT_SYNC_PAGES },
        { scope: "popular" as const, kind, pages: DEFAULT_SYNC_PAGES },
      ]);
      const tick = (): void => {
        scheduledChain = scheduledChain.then(async () => {
          for (const request of warmup) {
            if (running !== null) break;
            running = { startedAt: now(), request, triggered: "system" };
            await syncOnce(request, {}, "system");
          }
        });
        scheduleTimer = setTimeout(tick, intervalMs);
      };
      tick();
    },

    clearSchedule(): void {
      stopped = true; // the in-flight runSync checks this between pages and leaves the store alone
      if (scheduleTimer !== undefined) clearTimeout(scheduleTimer);
      scheduleTimer = undefined;
      scheduleMs = undefined;
    },

    /** Test seam: resolves when no sync is running and the scheduled chain has settled. */
    async idle(): Promise<void> {
      while (running !== null) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      await scheduledChain;
    },
  };
}
