/** The job DTO (docs/03 section 3.9). Anything long-running is one of these rows. */
import { z } from "zod";

/** The kinds the fileserver accepts (the kinds the existing `jobs` table checks). */
export const JOB_KINDS = ["folder-scan", "media-probe", "poster-fetch"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_STATES = [
  "queued",
  "running",
  "cancelling",
  "done",
  "failed",
  "cancelled",
  "interrupted",
] as const;
export type JobState = (typeof JOB_STATES)[number];

/** Settled states can be dismissed; the rest still belong to a runner or the queue. */
export const SETTLED_JOB_STATES: readonly JobState[] = ["done", "failed", "cancelled", "interrupted"];

export const JobKindSchema = z.enum(JOB_KINDS);
export const JobStateSchema = z.enum(JOB_STATES);

export interface Job {
  id: string;
  kind: JobKind;
  /** A short sentence such as "Scanning Music" — never a path (3.9). */
  label: string;
  state: JobState;
  percent?: number;
  error?: { code: string; message: string };
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}
