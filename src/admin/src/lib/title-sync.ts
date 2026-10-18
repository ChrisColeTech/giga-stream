import type { BulkPlan, BulkWords } from "@/lib/bulk-plan";
import type { AdminJob } from "@/services/schemas/job-schema";

/* `Sync now` on the Stored titles list (`docs/41` section 5.3), pure: it runs every ENABLED catalog job, one after the
 * other, through the shared bulk runner (the Jobs service the Jobs tab uses; no route of its own). Its reasons, in
 * priority order: the backend cannot be reached, a run is going (this one, or a job the last read of the Jobs list says is
 * running), and no catalog job is enabled. */

export const SYNC_NOW = "Sync now";
export const SYNC_RUNNING = "A sync is already running.";
export const NO_CATALOG_JOB = "No catalog job is enabled. Enable one on the Jobs tab.";
export const SYNC_UNREACHABLE = "The admin backend cannot be reached.";
export const SYNC_WORDS: BulkWords = { past: "Synced", noun: "catalog job", nouns: "catalog jobs" };

export const enabledCatalogJobs = (jobs: readonly AdminJob[]): AdminJob[] =>
  jobs.filter((job) => job.type === "catalog" && job.enabled);

export interface SyncState {
  /** The Jobs list as last read; null while the Jobs tab has not read it (the press reads it). */
  readonly jobs: readonly AdminJob[] | null;
  /** Syncs the statusbar counts as running. */
  readonly syncing: number;
  /** A bulk run of this list is going. */
  readonly busy: boolean;
  readonly unreachable: boolean;
}

/** Why `Sync now` is disabled, or undefined. */
export function syncReason(state: SyncState): string | undefined {
  if (state.unreachable) return SYNC_UNREACHABLE;
  if (state.busy || state.syncing > 0 || (state.jobs?.some((job) => job.running) ?? false)) return SYNC_RUNNING;
  if (state.jobs !== null && enabledCatalogJobs(state.jobs).length === 0) return NO_CATALOG_JOB;
  return undefined;
}

/** The plan of a press: one runnable item per enabled catalog job, named as the Jobs tab names it. */
export function syncPlan(jobs: readonly AdminJob[]): BulkPlan<number> {
  return { runnable: enabledCatalogJobs(jobs).map((job) => ({ id: job.id, label: job.name })), refused: [] };
}
