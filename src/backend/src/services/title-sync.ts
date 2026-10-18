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
import { createTitleWalk } from "./title-walk.js";

/** How one finished run ended (docs/44 section 3.2): `titles` counts the rows seen before the end. */
export interface SyncResult {
  result: "ok" | "failed" | "stopped";
  /** The `AppError` code of a failed run; `internal.failure` for anything unexpected. */
  code?: string;
  titles: number;
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
  const walk = createTitleWalk({ store, tmdb, storeRow: createStoreRow({ store, deleted: deps.deleted, now }) });

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
    const seen = { titles: 0 };
    let result: SyncResult;
    try {
      await walk(request, { signal, report: options.report ?? noReport, seen, shuttingDown: () => stopped });
      result = { result: signal.aborted || stopped ? "stopped" : "ok", titles: seen.titles };
    } catch (error: unknown) {
      if (signal.aborted || stopped) result = { result: "stopped", titles: seen.titles };
      else {
        const code = error instanceof AppError ? error.code : ERRORS.internalFailure.code;
        result = { result: "failed", code, titles: seen.titles };
      }
    } finally {
      running = null;
    }
    const audited = { ...detail, titles: result.titles };
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
