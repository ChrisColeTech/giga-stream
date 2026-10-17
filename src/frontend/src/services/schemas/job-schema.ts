import { z } from "zod";

export const JobSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["folder-scan", "media-probe", "poster-fetch"]),
  label: z.string().min(1),
  state: z.enum(["queued", "running", "cancelling", "done", "failed", "cancelled", "interrupted"]),
  percent: z.number().min(0).max(100).optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
  createdAt: z.number().int().nonnegative(),
  startedAt: z.number().int().nonnegative().optional(),
  finishedAt: z.number().int().nonnegative().optional(),
});

export const JobListSchema = z.array(JobSchema);
