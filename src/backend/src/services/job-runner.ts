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
import type { CatalogJobDispatcher } from "./catalog-job-dispatcher.js";

const disabled = (reason: string): AppError => new AppError(ERRORS.jobDisabled, { reason }, reason);

/** Persist codes, never exception messages. */
const codeOf = (error: unknown): string => (error instanceof AppError ? error.code : ERRORS.internalFailure.code);

interface Flight {
  abort: AbortController;
  settled: Promise<JobRecord | undefined>;
}

/** Process-local single flight per job. HTTP detaches; workers await the persisted settlement. */
export function createJobRunner(deps: {
  store: { jobs: Pick<Store["jobs"], "find" | "recordRun">; playlists: Pick<Store["playlists"], "find"> };
  audit: Pick<AuditService, "record">;
  now: () => number;
  playlistJob: PlaylistJobBody;
  titles: Pick<TitleService, "runNow" | "status" | "isSyncRunning">;
  /** Where every run reports its progress (docs/44 section 3.1). */
  progress: JobProgressRegistry;
  /** Called when a run settles, so the scheduler can arm for the next due job. */
  onSettled: () => void;
  executionDisabledReason?: string;
  catalogDispatcher?: CatalogJobDispatcher;
}) {
  const { store, audit, now, playlistJob, titles, progress, onSettled } = deps;
  const flights = new Map<number, Flight>();
  const settlements = new Map<number, Flight["settled"]>();

  const executionReason = (job: JobRecord): string | undefined =>
    deps.executionDisabledReason !== undefined && !(job.type === "catalog" && deps.catalogDispatcher !== undefined)
      ? deps.executionDisabledReason : undefined;

  /** Why this job cannot run by hand; Enabled gates only its schedule. */
  async function refusal(job: JobRecord): Promise<string | undefined> {
    const disabledReason = executionReason(job);
    if (disabledReason !== undefined) return disabledReason;
    if (job.type === "catalog") return undefined;
    const playlist = await store.playlists.find(job.playlistId);
    if (!playlist) return "The job's playlist no longer exists.";
    return playlist.enabled ? undefined : "The job's playlist is disabled; enable it to run this job.";
  }

  /** The schedule also needs the job itself enabled; a manual run does not. */
  const scheduledRefusal = async (job: JobRecord): Promise<string | undefined> =>
    deps.executionDisabledReason ?? (!job.enabled ? "The job is disabled; enable it to run it." : refusal(job));

  async function keep(job: JobRecord, result: RunResult, counts: RunCounts, cursorAt?: number): Promise<void> {
    if (await store.jobs.find(job.id)) await store.jobs.recordRun(job.id, now(), result, counts, cursorAt);
  }

  /** The stream's terminal value, absent when the job is gone or the store closed. */
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

  /** A successful recent run advances its cursor; stopped or failed work is covered again next time. */
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
    const settled = body.then(() => store.jobs.find(job.id)).finally(async () => {
      flights.delete(job.id);
      // After the flight is gone, so a client that refetches on `finished` reads the job as no longer running.
      progress.finish(await finishedOf(job.id));
      onSettled();
    });
    flights.set(job.id, { abort, settled });
    settlements.set(job.id, settled);
    // HTTP callers detach; headless callers observe persistence failures through wait().
    void settled.catch(() => undefined);
  }

  function abort(id: number): boolean {
    const flight = flights.get(id);
    flight?.abort.abort();
    return flight !== undefined;
  }

  async function stop(id: number, limitMs = PLAYLIST_DELETE_SETTLE_MS): Promise<boolean> {
    const flight = flights.get(id);
    if (!flight) return false;
    abort(id);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bounded = new Promise<void>((resolve) => (timer = setTimeout(resolve, limitMs)));
    await Promise.race([flight.settled.catch(() => undefined), bounded]);
    clearTimeout(timer);
    return true;
  }

  return {
    refusal,
    scheduledRefusal,
    isRunning: (id: number): boolean => flights.has(id),
    stop,
    abort,
    executionDisabledReason: executionReason,
    assertCatalogExecutable: (): void => {
      if (deps.executionDisabledReason !== undefined && deps.catalogDispatcher === undefined) {
        throw disabled(deps.executionDisabledReason);
      }
    },
    wait: (id: number): Promise<JobRecord | undefined> =>
      settlements.get(id) ?? Promise.reject(new AppError(ERRORS.jobNotRunning)),

    run: async (job: JobRecord, actor: Actor, triggered: "admin" | "system" = "admin"): Promise<void> => {
      const reason = await refusal(job);
      if (reason !== undefined) throw disabled(reason);
      if (job.type === "catalog" && deps.catalogDispatcher !== undefined) {
        await deps.catalogDispatcher.run(job);
        return;
      }
      start(job, actor, triggered);
    },

    runScheduled: async (job: JobRecord): Promise<"started" | "busy" | "skipped"> => {
      if ((await scheduledRefusal(job)) !== undefined || flights.has(job.id)) return "skipped";
      if (job.type === "catalog" && titles.isSyncRunning()) return "busy";
      start(job, {}, "system");
      return "started";
    },

    async shutdown(): Promise<void> {
      const active = [...flights.values()];
      for (const flight of active) flight.abort.abort();
      await Promise.allSettled(active.map((flight) => flight.settled));
    },
  };
}

export type JobRunner = ReturnType<typeof createJobRunner>;
