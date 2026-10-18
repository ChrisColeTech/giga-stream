import { AppError, ERRORS } from "../constants/errors.js";
import type { Store } from "../store/store.js";
import type { ProgressReport } from "../types/job-progress.js";
import { type Actor, type AuditService } from "./audit-service.js";
import { type OmdbClient } from "./omdb-client.js";
import { type TitleDeleted } from "./title-deleted.js";
import { type TmdbClient } from "./tmdb-client.js";
import { describeRequest } from "./title-sync-request.js";
import { createStoreRow } from "./title-store-row.js";
import { TITLE_FRESH_MS, type SyncRequest } from "./title-shapes.js";
import { createDetailFetch } from "./title-detail-fetch.js";
import { createDetailsPhase } from "./title-details-phase.js";
import { createOmdbStep } from "./title-omdb-step.js";
import { createGenreSync } from "./title-genre-sync.js";
import { type PhaseRun, type Seen, isStopping } from "./title-run.js";
import { createTitleWalk } from "./title-walk.js";
import { createAiringPhase } from "./title-airing.js";
import { createRecentPhase } from "./title-recent.js";
import { createLibraryUpdate } from "./title-update.js";

/** How one finished run ended (docs/44 section 3.2): `titles` counts the rows seen before the end. */
export interface SyncResult {
  result: "ok" | "failed" | "stopped";
  /** The `AppError` code of a failed run; `internal.failure` for anything unexpected. */
  code?: string;
  titles: number;
  /** Titles given their detail, and seasons given their episodes, this run (docs/47 section 3.1). */
  detailed: number;
  seasons: number;
  /** Titles given an OMDb block, this run (docs/11 section 7.3). */
  enriched: number;
  /** Stored series the Library update found airing in its window (docs/49). */
  airing: number;
}

/** What a caller hands one run: its stop signal and where its progress goes. */
export interface RunOptions {
  signal?: AbortSignal;
  report?: ProgressReport;
}

/** An in-flight sync, kept in memory for the status and the single-flight rule. */
interface Running {
  startedAt: number;
}

const noReport: ProgressReport = () => undefined;

/**
 * The catalog sync (docs/03 section 7.6b): single-flight and audited; its outcome is read from the status. Nothing
 * here owns a timer: a catalog job (`job-runner.ts`) asks for a run, and the backend's one scheduler decides when.
 * Each run has its own `AbortSignal` (the job's `Stop`); the module's `stopped` flag is for shutdown only.
 */
export function createTitleSync(deps: {
  store: Store;
  audit: AuditService;
  tmdb: TmdbClient;
  omdb: OmdbClient;
  deleted: TitleDeleted;
  now: () => number;
}) {
  const { store, audit, tmdb, omdb, now } = deps;
  const storeRow = createStoreRow({ store, deleted: deps.deleted, now });
  const walk = createTitleWalk({ store, tmdb, storeRow, now });
  const details = createDetailsPhase({
    store, fetchDetail: createDetailFetch({ store, tmdb, now }), omdb, enrichOmdb: createOmdbStep({ store, omdb, now }), now,
  });
  const syncGenres = createGenreSync({ store, tmdb });
  const update = createLibraryUpdate({
    recent: createRecentPhase({ store, tmdb, storeRow, now }),
    airing: createAiringPhase({ store, tmdb, storeRow, now }),
    refresh: details,
  });

  let running: Running | null = null;
  let lastRun: { finishedAt: number; outcome: string } | null = null;
  let stopped = false;

  type AuditAction = "sync.started" | "sync.finished" | "sync.failed" | "sync.stopped";
  function recordSyncAudit(action: AuditAction, actor: Actor, detail: Record<string, unknown>): void {
    if (stopped) return; // shutting down: the store may already be closed
    try {
      audit.record(actor, { action, subject: "titles", detail });
    } catch {
      // a shutdown between the guard and the write; the entry is lost, not the process
    }
  }

  /** One observed sync run: audited started and finished, failed or stopped; the result typed; the slot released. */
  async function syncOnce(request: SyncRequest, actor: Actor, triggered: "admin" | "system", options: RunOptions) {
    const detail = triggered === "system" ? { ...describeRequest(request), triggered } : describeRequest(request);
    const signal = options.signal ?? new AbortController().signal;
    recordSyncAudit("sync.started", actor, detail);
    const seen: Seen = { titles: 0, detailed: 0, seasons: 0, enriched: 0, airing: 0 };
    const notes: string[] = [];
    let result: SyncResult;
    try {
      const run: PhaseRun = { signal, report: options.report ?? noReport, seen, shuttingDown: () => stopped, notes };
      // The Library fill (scope `discover`) is the whole sync: genres, the walk, then details (docs/47 3.1).
      tmdb.resetPace();
      if (request.scope === "recent") {
        // The Library update (docs/49): the genres, then `recent`, `airing` and `refresh` in one run.
        await syncGenres(signal);
        await update(request, run);
      } else {
        if (request.scope === "discover") await syncGenres(signal);
        await walk(request, run);
        if (request.scope === "discover" && !isStopping(run)) await details(run);
      }
      result = { result: isStopping(run) ? "stopped" : "ok", ...seen };
    } catch (error: unknown) {
      if (signal.aborted || stopped) result = { result: "stopped", ...seen };
      else {
        const code = error instanceof AppError ? error.code : ERRORS.internalFailure.code;
        result = { result: "failed", code, ...seen };
      }
    } finally {
      running = null;
    }
    const { detailed, seasons, enriched, airing } = result;
    const audited = {
      ...detail, titles: result.titles, detailed, seasons, enriched, airing, ...(notes.length > 0 && { notes }),
    };
    if (result.result === "ok") recordSyncAudit("sync.finished", actor, audited);
    else if (result.result === "stopped") recordSyncAudit("sync.stopped", actor, audited);
    else recordSyncAudit("sync.failed", actor, { ...audited, code: result.code });
    if (!stopped) lastRun = { finishedAt: now(), outcome: result.result === "failed" ? (result.code ?? "failed") : result.result };
    return result;
  }

  return {
    isRunning: (): boolean => running !== null,

    /**
     * Run a sync and wait for it: the scheduler's run and a catalog job's. Single flight: `409 sync.busy` while one
     * runs. The answer is typed and never throws once the run began.
     */
    runNow(request: SyncRequest, actor: Actor, triggered: "admin" | "system", options: RunOptions = {}): Promise<SyncResult> {
      if (running !== null) throw new AppError(ERRORS.syncBusy, { startedAt: running.startedAt });
      running = { startedAt: now() };
      return syncOnce(request, actor, triggered, options);
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
