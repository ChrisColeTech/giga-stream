import type { JobRecord } from "../store/job-repository.js";
import type { Store } from "../store/store.js";
import { intervalOf } from "./job-schedule.js";
import type { JobRunner } from "./job-runner.js";

/** The longest a timer may wait (a 32-bit millisecond count); a longer wait is simply re-armed when it ends. */
const MAX_WAIT_MS = 2_147_483_647;
/** How long to wait before trying again when the job's engine was busy with another run. */
const BUSY_RETRY_MS = 1_000;

/**
 * The backend's one timer (docs/26 section 3.11, `01` section 4.4). It is armed for the earliest due job that is
 * enabled, has a schedule and can run; when it fires it runs that job, then arms itself again. A job that has
 * never run is due at once. Anything that changes a job's `enabled` or `schedule`, or a playlist's `enabled`, calls
 * `arm()`, so the change takes effect with no restart. Runs are one at a time.
 */
export function createSyncScheduler(deps: {
  store: Store;
  runner: JobRunner;
  now: () => number;
  /** Whether TMDB has a token: a catalog job is not scheduled without one. */
  tmdbConfigured: boolean;
}) {
  const { store, runner, now } = deps;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let firing = false;
  let stopped = false;

  const dueAt = (job: JobRecord, interval: number): number => (job.lastRunAt === undefined ? 0 : job.lastRunAt + interval);

  function next(): { job: JobRecord; at: number } | undefined {
    let best: { job: JobRecord; at: number } | undefined;
    for (const job of store.jobs.list()) {
      const interval = intervalOf(job.schedule);
      if (interval === undefined || runner.refusal(job) !== undefined) continue;
      if (job.type === "catalog" && !deps.tmdbConfigured) continue;
      const at = dueAt(job, interval);
      if (best === undefined || at < best.at) best = { job, at };
    }
    return best;
  }

  function wait(ms: number, then: () => void): void {
    timer = setTimeout(then, Math.min(Math.max(ms, 0), MAX_WAIT_MS));
  }

  async function fire(id: number): Promise<void> {
    firing = true;
    let retryMs: number | undefined;
    try {
      const job = store.jobs.find(id);
      if (job !== undefined && !stopped && (await runner.runScheduled(job)) === "busy") retryMs = BUSY_RETRY_MS;
    } finally {
      firing = false;
    }
    arm(retryMs);
  }

  /** Arms the one timer for the earliest due job (or `delayMs` from now), replacing whatever it was waiting for. */
  function arm(delayMs?: number): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (stopped || firing) return; // a run in progress arms the next one when it ends
    const due = next();
    if (due === undefined) return;
    wait(delayMs ?? due.at - now(), () => void fire(due.job.id));
  }

  return {
    arm: () => arm(),
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
