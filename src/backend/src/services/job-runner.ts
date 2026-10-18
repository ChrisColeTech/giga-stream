import { AppError, ERRORS } from "../constants/errors.js";
import { PLAYLIST_DELETE_SETTLE_MS } from "../constants/limits.js";
import type { CatalogJob, JobRecord, PlaylistJob } from "../store/job-repository.js";
import type { Store } from "../store/store.js";
import type { RunCounts, RunResult } from "../types/job-counts.js";
import type { Actor, AuditService } from "./audit-service.js";
import type { PlaylistJobBody, RunOutcome } from "./playlist-job.js";
import type { TitleService } from "./title-service.js";

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
  /** Called when a run settles, so the scheduler can arm for the next due job. */
  onSettled: () => void;
}) {
  const { store, audit, now, playlistJob, titles, onSettled } = deps;
  const flights = new Map<number, Flight>();

  /** Why this job cannot be run by hand, or undefined when it can: its playlist must be enabled (docs/26 3.11). */
  function refusal(job: JobRecord): string | undefined {
    if (job.type === "catalog") return job.enabled ? undefined : "The job is disabled; enable it to run it.";
    const playlist = store.playlists.find(job.playlistId);
    if (!playlist) return "The job's playlist no longer exists.";
    return playlist.enabled ? undefined : "The job's playlist is disabled; enable it to run this job.";
  }

  /** The schedule also needs the job itself enabled; a manual run does not. */
  const scheduledRefusal = (job: JobRecord): string | undefined =>
    !job.enabled ? "The job is disabled; enable it to run it." : refusal(job);

  function keep(job: JobRecord, result: RunResult, counts: RunCounts): void {
    if (store.jobs.find(job.id)) store.jobs.recordRun(job.id, now(), result, counts);
  }

  async function runPlaylist(job: PlaylistJob, actor: Actor, signal: AbortSignal): Promise<void> {
    const host = store.playlists.find(job.playlistId)?.host;
    let outcome: RunOutcome;
    try {
      outcome = await playlistJob(job, signal);
    } catch (error) {
      outcome = { result: "failed", counts: { code: codeOf(error) } };
    }
    keep(job, outcome.result, outcome.counts);
    try {
      if (store.playlists.find(job.playlistId)) {
        audit.record(actor, {
          action: "playlist.synced",
          subject: String(job.playlistId),
          detail: { result: outcome.result, ...outcome.counts, ...(host !== undefined && { host }) },
        });
      }
    } catch {
      // a shutdown between the run and the write; the entry is lost, not the process
    }
  }

  async function runCatalog(job: CatalogJob, actor: Actor, triggered: "admin" | "system"): Promise<void> {
    try {
      const result = await titles.runNow({ scope: job.config.scope, kind: job.config.kind, pages: job.config.pages }, actor, triggered);
      if (result.outcome === "ok") keep(job, "ok", { titles: result.titles, stale: titles.status().stale });
      else keep(job, "failed", { code: ERRORS.internalFailure.code });
    } catch (error) {
      keep(job, "failed", { code: codeOf(error) });
    }
  }

  /** Claims the job's flight and starts the run without awaiting it. */
  function start(job: JobRecord, actor: Actor, triggered: "admin" | "system"): void {
    if (flights.has(job.id)) throw new AppError(ERRORS.syncBusy, { id: job.id }, "That job is already running.");
    if (job.type === "catalog" && titles.isSyncRunning()) throw new AppError(ERRORS.syncBusy, { id: job.id });
    const abort = new AbortController();
    const body = job.type === "playlist" ? runPlaylist(job, actor, abort.signal) : runCatalog(job, actor, triggered);
    const settled = body.catch(() => undefined).finally(() => {
      flights.delete(job.id);
      onSettled();
    });
    flights.set(job.id, { abort, settled });
  }

  /** Aborts a job's run and waits for it to settle, at most `limitMs`; true when a run was in flight. */
  async function stop(id: number, limitMs = PLAYLIST_DELETE_SETTLE_MS): Promise<boolean> {
    const flight = flights.get(id);
    if (!flight) return false;
    flight.abort.abort();
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

    /** An admin's run: refused when the job cannot run (`422 job.disabled`), `409 sync.busy` while it does. */
    run(job: JobRecord, actor: Actor): void {
      const reason = refusal(job);
      if (reason !== undefined) throw disabled(reason);
      start(job, actor, "admin");
    },

    /** The scheduler's run: started, never awaited; `busy` when the catalog engine is taken and the job should wait. */
    runScheduled(job: JobRecord): "started" | "busy" | "skipped" {
      if (scheduledRefusal(job) !== undefined || flights.has(job.id)) return "skipped";
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
