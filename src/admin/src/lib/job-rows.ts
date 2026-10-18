import type { AdminJob, CatalogJobConfig, PlaylistJobConfig } from "@/services/schemas/job-schema";
import { formatWhen } from "./format-when";
import { jobState, type RowState } from "./row-state";

/* A job as pure data (`38` section 4.2): its config narrowed by type, whether its last run failed, and the row a list
 * draws. No React, no store. */

export function playlistConfigOf(job: AdminJob): PlaylistJobConfig | null {
  return job.type === "playlist" && "playlistId" in job.config ? job.config : null;
}

export function catalogConfigOf(job: AdminJob): CatalogJobConfig | null {
  return job.type === "catalog" && "scope" in job.config ? job.config : null;
}

export const playlistIdOf = (job: AdminJob): number | null => playlistConfigOf(job)?.playlistId ?? null;

/** The catalog sync's own success word (`title-sync.ts`). */
const CATALOG_OK = "ok";

/** The last run failed: a playlist run that failed keeps its sentence and no counts; a catalog run's outcome is `ok` or
 *  the reason it failed. A job that never ran has not failed. */
export function lastRunFailed(job: AdminJob): boolean {
  if (job.lastRunAt === undefined) return false;
  if (job.type === "playlist") return job.lastCounts === undefined;
  return job.lastOutcome !== undefined && job.lastOutcome !== CATALOG_OK;
}

export const stateOfJob = (job: AdminJob): RowState =>
  jobState({ enabled: job.enabled, running: job.running, failed: lastRunFailed(job) });

const KIND_WORD: Readonly<Record<CatalogJobConfig["kind"], string>> = { movie: "movies", tv: "series" };

/** What the job syncs: the playlist's name, or the scope and kind (`trending movies`). */
export function targetOf(job: AdminJob): string {
  const catalog = catalogConfigOf(job);
  if (catalog !== null) return `${catalog.scope} ${KIND_WORD[catalog.kind]}`;
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
    schedule: job.schedule,
    lastRun: formatWhen(job.lastRunAt),
    outcome: job.lastOutcome ?? "",
    state: stateOfJob(job),
  };
}
