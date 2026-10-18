import type { AdminJob, CatalogJobConfig, PlaylistJobConfig } from "@/services/schemas/job-schema";
import { formatWhen } from "./format-when";
import { percentOf } from "./job-fraction";
import { scheduleLabel } from "./job-schedule";
import { jobState, type RowState } from "./row-state";
import { runWords } from "./run-words";

/* A job as pure data (`38` section 4.2): its config narrowed by type, whether its last run failed, and the row a list
 * draws. No React, no store. */

export function playlistConfigOf(job: AdminJob): PlaylistJobConfig | null {
  return job.type === "playlist" && "playlistId" in job.config ? job.config : null;
}

export function catalogConfigOf(job: AdminJob): CatalogJobConfig | null {
  return job.type === "catalog" && "scope" in job.config ? job.config : null;
}

export const playlistIdOf = (job: AdminJob): number | null => job.playlistId ?? playlistConfigOf(job)?.playlistId ?? null;

/** The last run failed: the backend records `failed` as a result of its own, never inferred from a missing field. A job
 *  that never ran has not failed. */
export const lastRunFailed = (job: AdminJob): boolean => job.lastRunAt !== undefined && job.lastResult === "failed";

/** The last run was stopped (`43` section 3.4a): the row reads `stopped` and the workspace offers `Resume`. */
export const lastRunStopped = (job: AdminJob): boolean => job.lastRunAt !== undefined && job.lastResult === "stopped";

/** The state word; a running job that has progress reads `running 46%` (the row's `data-st` stays `running`). */
export const stateOfJob = (job: AdminJob): RowState =>
  jobState({
    enabled: job.enabled,
    running: job.running,
    failed: lastRunFailed(job),
    stopped: lastRunStopped(job),
    ...(job.progress !== undefined && { percent: percentOf(job.progress) }),
  });

const KIND_WORD: Readonly<Record<NonNullable<CatalogJobConfig["kind"]>, string>> = { movie: "movies", tv: "series" };

/** What the job syncs: the playlist's name, or the scope and kind (`trending movies`; a discover walk covers both). */
export function targetOf(job: AdminJob): string {
  const catalog = catalogConfigOf(job);
  if (catalog !== null) return catalog.kind === undefined ? catalog.scope : `${catalog.scope} ${KIND_WORD[catalog.kind]}`;
  return job.playlistName ?? `playlist ${playlistIdOf(job) ?? ""}`.trim();
}

export const typeWord = (job: AdminJob): string => (job.type === "playlist" ? "Playlist" : "Catalog");

/** How many loaded jobs are running: the statusbar's `N syncing`. */
export const runningCount = (items: readonly AdminJob[]): number => items.filter((job) => job.running).length;

export interface JobRowView {
  readonly id: number;
  readonly name: string;
  readonly type: string;
  readonly target: string;
  readonly schedule: string;
  readonly lastRun: string;
  readonly outcome: string;
  readonly state: RowState;
}

export function jobRow(job: AdminJob): JobRowView {
  return {
    id: job.id,
    name: job.name,
    type: typeWord(job),
    target: targetOf(job),
    schedule: scheduleLabel(job.schedule),
    lastRun: formatWhen(job.lastRunAt),
    outcome: runWords(job.lastResult, job.lastCounts) ?? "",
    state: stateOfJob(job),
  };
}
