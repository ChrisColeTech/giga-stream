import { z } from "zod";
import { RunResultSchema } from "./run-counts-schema";

/* The frames of `GET /api/jobs/events` (`44` section 3.3): the admin's own copy of the backend's shapes (the programs never
 * import each other, `01` section 4.2). Job ids and numbers only: no URL, name or secret ever rides the stream. */
const whole = z.number().int().min(0);

/** A running job's latest progress: where it is and how far, in whole units of that phase. */
export const JobProgressSchema = z.object({ jobId: whole, phase: z.string().min(1), done: whole, total: whole });

/** `snapshot`: every running job, first on every connection. It is authoritative: a job absent from it has finished. */
export const SnapshotSchema = z.object({ running: z.array(JobProgressSchema) });

/** `finished`: a run ended. A job deleted during its run has neither field. */
export const FinishedSchema = z.object({
  jobId: whole,
  lastResult: RunResultSchema.optional(),
  lastRunAt: z.number().optional(),
});

export type JobProgress = z.infer<typeof JobProgressSchema>;
export type JobFinished = z.infer<typeof FinishedSchema>;

/** A frame the admin understands. */
export type JobEvent =
  | { readonly type: "snapshot"; readonly running: readonly JobProgress[] }
  | { readonly type: "progress"; readonly progress: JobProgress }
  | { readonly type: "finished"; readonly finished: JobFinished };
