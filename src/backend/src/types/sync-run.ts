import type { ProgressReport } from "./job-progress.js";

/** What the sync's steps share about the run they belong to (docs/43 section 3.4). */
export interface SyncRun {
  playlistId: number;
  /** Aborted by `Stop`, a playlist delete or shutdown; every request carries it. */
  signal: AbortSignal;
  /** When the run's 30-minute wall clock ends (a `now()` value): no step starts new work past it. */
  endsAt: number;
  /** Where the steps report their progress (docs/44 section 3.1): phases `reading`, `logos`, `checking`. */
  report: ProgressReport;
}
