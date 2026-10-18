import type { JobProgress } from "@/services/schemas/job-event-schema";
import { fractionOf } from "./job-fraction";

/* The running jobs as the statusbar reads them (`44` section 4), as pure transitions. The list is ordered by recency of
 * update, so the LAST entry is the most recently updated job (a mean would drop when one finished). Each entry keeps the
 * greatest fraction its run has reached: a report below it never moves the bar backwards. */
export interface LiveJob {
  readonly progress: JobProgress;
  /** 0 to 1; never decreases while the job stays in the list. */
  readonly fraction: number;
}

export const NO_LIVE: readonly LiveJob[] = [];

const entryOf = (progress: JobProgress, before: LiveJob | undefined): LiveJob => ({
  progress,
  fraction: Math.max(before?.fraction ?? 0, fractionOf(progress)),
});

/** One job's report: it moves to the end of the list (the most recent). */
export function withProgress(live: readonly LiveJob[], progress: JobProgress): readonly LiveJob[] {
  const before = live.find((entry) => entry.progress.jobId === progress.jobId);
  return [...live.filter((entry) => entry.progress.jobId !== progress.jobId), entryOf(progress, before)];
}

/** A run ended (or its job was deleted): it leaves the list. */
export const withoutJob = (live: readonly LiveJob[], jobId: number): readonly LiveJob[] =>
  live.some((entry) => entry.progress.jobId === jobId)
    ? live.filter((entry) => entry.progress.jobId !== jobId)
    : live;

/** A snapshot is authoritative: exactly these jobs run. A job that stays keeps its fraction; the last of `running` is the
 *  most recent. */
export const fromSnapshot = (live: readonly LiveJob[], running: readonly JobProgress[]): readonly LiveJob[] =>
  running.map((progress) => entryOf(progress, live.find((entry) => entry.progress.jobId === progress.jobId)));

/** The job ids in `before` that `after` no longer holds: runs that ended while nobody was listening. */
export const vanished = (before: readonly LiveJob[], after: readonly LiveJob[]): readonly number[] =>
  before.filter((a) => !after.some((b) => b.progress.jobId === a.progress.jobId)).map((a) => a.progress.jobId);

/** The most recently updated running job, or undefined while nothing runs. */
export const latestOf = (live: readonly LiveJob[]): LiveJob | undefined => live.at(-1);
