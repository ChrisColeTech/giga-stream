import { AppError, ERRORS } from "../constants/errors.js";
import type { JobRecord } from "../store/job-repository.js";
import type { Store } from "../store/store.js";
import type { JobRun } from "../types/job.js";
import type { PlaylistSyncAnswer } from "../types/playlist-sync.js";
import type { Actor } from "./audit-service.js";
import type { PlaylistSyncService } from "./playlist-sync-service.js";
import type { TitleService } from "./title-service.js";

const disabled = (reason: string): AppError => new AppError(ERRORS.jobDisabled, { reason }, reason);

/**
 * The sentence a playlist job keeps as its outcome: what the run did, or what a dry run would have done (docs/29 B4).
 */
const outcomeOf = (answer: PlaylistSyncAnswer, dryRun: boolean): string =>
  dryRun
    ? `Dry run. ${answer.created} to create, ${answer.updated} to update.`
    : `Synced: ${answer.created} created, ${answer.updated} updated.`;

/** The counts a playlist job keeps: the run's, with the refusal examples and the created ids (docs/29 B4). */
function countsOf(answer: PlaylistSyncAnswer): Record<string, unknown> {
  const { created, updated, skipped, refused, removed, kept, refusalExamples, createdIds } = answer;
  return { created, updated, skipped, refused, removed, kept, refusalExamples, createdIds };
}

/**
 * Runs sync jobs (docs/26 section 3.11). A playlist job syncs only its playlist, under the rules of 3.10; a catalog
 * job syncs its scope, kind and pages. A job is single-flight (`409 sync.busy`), and a disabled job - or one whose
 * playlist is missing or disabled - is refused with `422 job.disabled` and its reason. How each run went is kept on
 * the job (and on the playlist), whoever started it: an admin through the route, or the scheduler.
 */
export function createJobRunner(deps: {
  store: Store;
  now: () => number;
  playlistSync: PlaylistSyncService;
  titles: TitleService;
}) {
  const { store, now, playlistSync, titles } = deps;
  const running = new Set<number>();

  /** Why this job cannot run now, or undefined when it can. */
  function refusal(job: JobRecord): string | undefined {
    if (!job.enabled) return "The job is disabled; enable it to run it.";
    if (job.type === "playlist") {
      const playlist = store.playlists.find(job.config.playlistId);
      if (!playlist) return "The job's playlist no longer exists.";
      if (!playlist.enabled) return "The job's playlist is disabled; enable it to run this job.";
    }
    return undefined;
  }

  function record(job: JobRecord, outcome: string, counts: Record<string, unknown> | null): void {
    if (store.jobs.find(job.id)) store.jobs.recordRun(job.id, now(), outcome, counts);
  }

  async function execute(job: JobRecord, actor: Actor, triggered: "admin" | "system", override: JobRun): Promise<void> {
    if (job.type === "playlist") {
      const playlist = store.playlists.find(job.config.playlistId);
      if (!playlist) return;
      const dryRun = override.dryRun ?? job.config.dryRun;
      try {
        const answer = await playlistSync.run(
          { dryRun, prune: override.prune ?? job.config.prune },
          actor,
          [playlist],
        );
        record(job, outcomeOf(answer, dryRun), countsOf(answer));
      } catch (error) {
        // Being turned away because another playlist sync runs is not an outcome of this job.
        if (!(error instanceof AppError && error.code === ERRORS.playlistBusy.code)) {
          record(job, error instanceof Error ? error.message : "failed", null);
        }
        throw error;
      }
      return;
    }
    const result = await titles.runNow({ scope: job.config.scope, kind: job.config.kind, pages: job.config.pages }, actor, triggered);
    record(job, result.outcome, { titles: result.titles });
  }

  /** Claims the job's single flight, or says it is busy. */
  function claim(job: JobRecord): void {
    if (running.has(job.id)) throw new AppError(ERRORS.syncBusy, { id: job.id }, "That job is already running.");
    running.add(job.id);
  }

  return {
    refusal,
    isRunning: (id: number): boolean => running.has(id),

    /**
     * An admin's run. A playlist job is awaited and answers with its counts (a failure is raised after it is kept);
     * a catalog job takes a while, so it is started and the answer says it is running.
     */
    async run(job: JobRecord, actor: Actor, override: JobRun): Promise<void> {
      const reason = refusal(job);
      if (reason !== undefined) throw disabled(reason);
      claim(job);
      if (job.type === "catalog") {
        if (titles.isSyncRunning()) {
          running.delete(job.id);
          throw new AppError(ERRORS.syncBusy, { id: job.id });
        }
        void execute(job, actor, "admin", override).catch(() => undefined).finally(() => running.delete(job.id));
        return;
      }
      try {
        await execute(job, actor, "admin", override);
      } finally {
        running.delete(job.id);
      }
    },

    /** The scheduler's run: waited for, never raising; `busy` when the engine is taken and the job should wait. */
    async runScheduled(job: JobRecord): Promise<"done" | "busy"> {
      if (refusal(job) !== undefined) return "done";
      if (running.has(job.id) || (job.type === "catalog" && titles.isSyncRunning())) return "busy";
      claim(job);
      try {
        await execute(job, {}, "system", {});
      } catch (error) {
        if (error instanceof AppError && (error.code === ERRORS.playlistBusy.code || error.code === ERRORS.syncBusy.code)) return "busy";
      } finally {
        running.delete(job.id);
      }
      return "done";
    },
  };
}

export type JobRunner = ReturnType<typeof createJobRunner>;
