import type { ProgressReport } from "../types/job-progress.js";

/** What one Library fill run has done so far; read after an error too, so a failed or stopped run keeps its counts. */
export interface Seen {
  /** Rows TMDB listed in the walk (stored or skipped). */
  titles: number;
  /** Titles given their detail. */
  detailed: number;
  /** Seasons given their episodes. */
  seasons: number;
  /** Titles given an OMDb block. */
  enriched: number;
  /** Stored series that aired an episode in the Library update's window, forced to refresh (docs/49); zero in a fill. */
  airing: number;
}

/** What one run shares with its phases: its stop signal, its progress report and its counts. */
export interface PhaseRun {
  signal: AbortSignal;
  report: ProgressReport;
  seen: Seen;
  /** Set by shutdown: a phase ends between its calls. */
  shuttingDown: () => boolean;
  /** Things worth knowing about the run (a day too big to walk whole), kept in the audit detail. */
  notes?: string[];
}

/** A phase checks this between its calls: the admin's `Stop` or a shutdown ends the run where it stands. */
export const isStopping = (run: PhaseRun): boolean => run.signal.aborted || run.shuttingDown();
