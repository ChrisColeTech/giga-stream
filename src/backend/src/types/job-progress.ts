import type { RunResult } from "./job-counts.js";

/** What a running job reports (docs/44 section 3.1): where it is and how far, in whole units of that phase. */
export interface ProgressUpdate {
  phase: string;
  done: number;
  total: number;
}

/** A running job's latest progress, held in memory only. */
export interface JobProgress extends ProgressUpdate {
  jobId: number;
}

/** What a job runner is handed to report with; it never touches the stream. */
export type ProgressReport = (update: ProgressUpdate) => void;

/** A run that ended, as the stream tells it. A job deleted during its run has neither field. */
export interface JobFinished {
  jobId: number;
  lastResult?: RunResult;
  lastRunAt?: number;
}

export type JobEvent = { type: "progress"; progress: JobProgress } | ({ type: "finished" } & JobFinished);
