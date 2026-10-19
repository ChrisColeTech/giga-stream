import { FIRST_RUN_GRACE_MS } from "../constants/limits.js";
import type { JobRecord } from "../store/job-repository.js";
import type { Store } from "../store/store.js";
import { intervalOf } from "./job-schedule.js";
import type { JobRunner } from "./job-runner.js";

/** The longest a timer may wait (a 32-bit millisecond count); a longer wait is simply re-armed when it ends. */
const MAX_WAIT_MS = 2_147_483_647;
/** How long to wait before trying again when the job's engine was busy with another run. */
const BUSY_RETRY_MS = 1_000;

/**
 * The backend's one timer (docs/26 section 3.11, `01` section 4.4, docs/43 section 3.4). It is armed for the earliest
 * due job that is enabled, has a schedule and can run; when it fires it STARTS that job and arms itself again at once -
 * it never awaits a run, and a job that is running is not due, so one long sync cannot starve another job or freeze
 * re-arming. A run that settles arms it again. A job that has never run is due at once, but never earlier than the
 * process start plus `FIRST_RUN_GRACE_MS`, so nothing runs during boot. Anything that changes a job's `enabled` or
 * `schedule`, or a playlist's `enabled`, calls `arm()`, so the change takes effect with no restart.
 */
export function createSyncScheduler(deps: {
  store: { jobs: Pick<Store["jobs"], "list" | "find"> };
  runner: Pick<JobRunner, "scheduledRefusal" | "isRunning" | "runScheduled">;
  now: () => number;
  /** Whether TMDB has a token: a catalog job is not scheduled without one. */
  tmdbConfigured: boolean;
}) {
  const { store, runner, now } = deps;
  const notBefore = now() + FIRST_RUN_GRACE_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const dueAt = (job: JobRecord, interval: number): number =>
    Math.max(job.lastRunAt === undefined ? 0 : job.lastRunAt + interval, notBefore);

  async function next(): Promise<{ job: JobRecord; at: number } | undefined> {
    let best: { job: JobRecord; at: number } | undefined;
    for (const job of await store.jobs.list()) {
      const interval = intervalOf(job.schedule);
      if (interval === undefined || (await runner.scheduledRefusal(job)) !== undefined || runner.isRunning(job.id)) continue;
      if (job.type === "catalog" && !deps.tmdbConfigured) continue;
      const at = dueAt(job, interval);
      if (best === undefined || at < best.at) best = { job, at };
    }
    return best;
  }

  async function fire(id: number): Promise<void> {
    const job = await store.jobs.find(id);
    const retry = job !== undefined && !stopped && (await runner.runScheduled(job)) === "busy";
    arm(retry ? BUSY_RETRY_MS : undefined);
  }

  /** Arms the one timer for the earliest due job (or `delayMs` from now), replacing whatever it was waiting for. */
  async function arm(delayMs?: number): Promise<void> {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (stopped) return;
    const due = await next();
    if (due === undefined) return;
    timer = setTimeout(() => void fire(due.job.id), Math.min(Math.max(delayMs ?? due.at - now(), 0), MAX_WAIT_MS));
  }

  return {
    /** Arms for the earliest due job; the promise settles once the timer is set (a test may await it). */
    arm: (delayMs?: number): Promise<void> => arm(delayMs),
    /** Whether a timer is waiting (a test seam: it says whether anything is armed). */
    armed: (): boolean => timer !== undefined,
    /** Shutdown: no more runs, no timer. */
    stop(): void {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
  };
}

export type SyncScheduler = ReturnType<typeof createSyncScheduler>;
