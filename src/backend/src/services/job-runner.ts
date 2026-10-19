import { AppError, ERRORS } from "../constants/errors.js";
import { CURSOR_OVERLAP_MS, PLAYLIST_DELETE_SETTLE_MS } from "../constants/limits.js";
import type { CatalogJob, JobRecord, PlaylistJob } from "../store/job-repository.js";
import type { Store } from "../store/store.js";
import type { RunCounts, RunResult } from "../types/job-counts.js";
import type { Actor, AuditService } from "./audit-service.js";
import type { JobFinished, ProgressReport } from "../types/job-progress.js";
import type { JobProgressRegistry } from "./job-progress.js";
import type { PlaylistJobBody, RunOutcome } from "./playlist-job.js";
import type { SyncRequest, TitleService } from "./title-service.js";
import { firstPhase } from "./title-walk.js";

const disabled = (reason: string): AppError => new AppError(ERRORS.jobDisabled, { reason }, reason);

/** The code a failed run keeps: an `AppError`'s own, else `internal.failure`. An exception's message is never stored. */
const codeOf = (error: unknown): string => (error instanceof AppError ? error.code : ERRORS.internalFailure.code);

interface Flight {
  abort: AbortController;
  settled: Promise<void>;
}

/**
 * Runs sync jobs (docs/43 section 3.4, docs/26 section 3.11). A run is STARTED, never awaited by its caller: the
 * route answers `202` and the result is read on a refresh. One run per job - and a playlist has one job - so the
 * single flight is per playlist (`409 sync.busy`). Each run owns an `AbortController`: deleting a playlist (or
 * shutting down) aborts it and waits for it to settle. A run keeps its result on the job, typed: `ok`, `failed` (with
 * the error's code) or `stopped`.
 */
export function createJobRunner(deps: {
  store: Store;
  audit: AuditService;
  now: () => number;
  playlistJob: PlaylistJobBody;
  titles: TitleService;
  /** Where every run reports its progress (docs/44 section 3.1). */
  progress: JobProgressRegistry;
  /** Called when a run settles, so the scheduler can arm for the next due job. */
  onSettled: () => void;
}) {
  const { store, audit, now, playlistJob, titles, progress, onSettled } = deps;
  const flights = new Map<number, Flight>();

  /** Why this job cannot be run by hand, or undefined when it can: a playlist job needs its playlist enabled; the
   *  job's own `enabled` switch gates only the schedule (docs/26 3.11). */
  async function refusal(job: JobRecord): Promise<string | undefined> {
    if (job.type === "catalog") return undefined;
    const playlist = await store.playlists.find(job.playlistId);
    if (!playlist) return "The job's playlist no longer exists.";
    return playlist.enabled ? undefined : "The job's playlist is disabled; enable it to run this job.";
  }

  /** The schedule also needs the job itself enabled; a manual run does not. */
  const scheduledRefusal = async (job: JobRecord): Promise<string | undefined> =>
    !job.enabled ? "The job is disabled; enable it to run it." : refusal(job);

  async function keep(job: JobRecord, result: RunResult, counts: RunCounts, cursorAt?: number): Promise<void> {
    if (await store.jobs.find(job.id)) await store.jobs.recordRun(job.id, now(), result, counts, cursorAt);
  }

  /** The end of a run as the stream tells it: the result the job now holds (none when the job is gone or the store closed). */
  async function finishedOf(jobId: number): Promise<JobFinished> {
    try {
      const ended = await store.jobs.find(jobId);
      return { jobId, ...(ended?.lastResult !== undefined && { lastResult: ended.lastResult }),
        ...(ended?.lastRunAt !== undefined && { lastRunAt: ended.lastRunAt }) };
    } catch {
      return { jobId };
    }
  }

  async function runPlaylist(job: PlaylistJob, actor: Actor, signal: AbortSignal, report: ProgressReport): Promise<void> {
    const host = (await store.playlists.find(job.playlistId))?.host;
    let outcome: RunOutcome;
    try {
      outcome = await playlistJob(job, signal, report);
    } catch (error) {
      outcome = { result: "failed", counts: { code: codeOf(error) } };
    }
    await keep(job, outcome.result, outcome.counts);
    try {
      if (await store.playlists.find(job.playlistId)) {
        await audit.record(actor, {
          action: "playlist.synced",
          subject: String(job.playlistId),
          detail: { result: outcome.result, ...outcome.counts, ...(host !== undefined && { host }) },
        });
      }
    } catch {
      // a shutdown between the run and the write; the entry is lost, not the process
    }
  }

  /**
   * A catalog run's typed result becomes the job's: `ok`, `stopped` (the rows seen are kept) or `failed` with a code. A
   * Library update (scope `recent`) takes no kind or page count and asks from its cursor; only an `ok` run moves the cursor,
   * to the run's START minus an hour, so a stopped or failed run is covered again by the next (docs/49 section 2.4).
   */
  async function runCatalog(
    job: CatalogJob, actor: Actor, triggered: "admin" | "system", signal: AbortSignal, report: ProgressReport,
  ): Promise<void> {
    const startedAt = now();
    const recent = job.config.scope === "recent";
    try {
      const request: SyncRequest = "kind" in job.config
        ? { scope: job.config.scope, kind: job.config.kind, pages: job.config.pages }
        : job.config.scope === "recent"
          ? { scope: "recent", ...(job.cursorAt !== undefined && { since: job.cursorAt }) }
          : { scope: "discover" };
      const done = await titles.runNow(request, actor, triggered, { signal, report });
      const { titles: seen, detailed, seasons, enriched, airing } = done;
      const counts = { titles: seen, detailed, seasons, enriched, airing, stale: (await titles.status()).stale };
      if (done.result === "ok") await keep(job, "ok", counts, recent ? startedAt - CURSOR_OVERLAP_MS : undefined);
      else if (done.result === "stopped") await keep(job, "stopped", { ...counts, stopped: true });
      else await keep(job, "failed", { code: done.code ?? ERRORS.internalFailure.code });
    } catch (error) {
      await keep(job, "failed", { code: codeOf(error) });
    }
  }

  /** Claims the job's flight and starts the run without awaiting it. */
  function start(job: JobRecord, actor: Actor, triggered: "admin" | "system"): void {
    if (flights.has(job.id)) throw new AppError(ERRORS.syncBusy, { id: job.id }, "That job is already running.");
    if (job.type === "catalog" && titles.isSyncRunning()) throw new AppError(ERRORS.syncBusy, { id: job.id });
    const abort = new AbortController();
    const { signal } = abort;
    const body = job.type === "playlist"
      ? runPlaylist(job, actor, signal, progress.start(job.id, "reading"))
      : runCatalog(job, actor, triggered, signal, progress.start(job.id, firstPhase(job.config)));
    const settled = body.catch(() => undefined).finally(async () => {
      flights.delete(job.id);
      // After the flight is gone, so a client that refetches on `finished` reads the job as no longer running.
      progress.finish(await finishedOf(job.id));
      onSettled();
    });
    flights.set(job.id, { abort, settled });
  }

  /** Aborts a job's run without waiting for it (the admin's `Stop`); true when a run was in flight. */
  function abort(id: number): boolean {
    const flight = flights.get(id);
    flight?.abort.abort();
    return flight !== undefined;
  }

  /** Aborts a job's run and waits for it to settle, at most `limitMs`; true when a run was in flight. */
  async function stop(id: number, limitMs = PLAYLIST_DELETE_SETTLE_MS): Promise<boolean> {
    const flight = flights.get(id);
    if (!flight) return false;
    abort(id);
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([flight.settled, new Promise<void>((resolve) => (timer = setTimeout(resolve, limitMs)))]);
    clearTimeout(timer);
    return true;
  }

  return {
    refusal,
    scheduledRefusal,
    isRunning: (id: number): boolean => flights.has(id),
    stop,
    abort,

    /** An admin's run: refused when the job cannot run (`422 job.disabled`), `409 sync.busy` while it does. */
    run: async (job: JobRecord, actor: Actor): Promise<void> => {
      const reason = await refusal(job);
      if (reason !== undefined) throw disabled(reason);
      start(job, actor, "admin");
    },

    /** The scheduler's run: started, never awaited; `busy` when the catalog engine is taken and the job should wait. */
    runScheduled: async (job: JobRecord): Promise<"started" | "busy" | "skipped"> => {
      if ((await scheduledRefusal(job)) !== undefined || flights.has(job.id)) return "skipped";
      if (job.type === "catalog" && titles.isSyncRunning()) return "busy";
      start(job, {}, "system");
      return "started";
    },

    /** Shutdown: every run is aborted and has settled before the store closes. */
    async shutdown(): Promise<void> {
      await Promise.all([...flights.keys()].map((id) => stop(id)));
    },
  };
}

export type JobRunner = ReturnType<typeof createJobRunner>;
