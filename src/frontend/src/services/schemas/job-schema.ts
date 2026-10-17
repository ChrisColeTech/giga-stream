import { z } from "zod";

const JobBaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  state: z.enum(["queued", "running", "cancelling", "done", "failed", "cancelled", "interrupted"]),
  percent: z.number().min(0).max(100).optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
  createdAt: z.number().int().nonnegative(),
  startedAt: z.number().int().nonnegative().optional(),
  finishedAt: z.number().int().nonnegative().optional(),
});

export const JobSchema = z.discriminatedUnion("kind", [
  JobBaseSchema.extend({ kind: z.literal("folder-scan"), folderId: z.string().min(1) }),
  JobBaseSchema.extend({ kind: z.literal("media-probe") }),
  JobBaseSchema.extend({ kind: z.literal("poster-fetch") }),
]);

export const JobListSchema = z.array(JobSchema);
