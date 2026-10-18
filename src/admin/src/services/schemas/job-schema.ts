import { z } from "zod";

/* `JobView` (`29` section 5): a playlist job carries its playlist and flags, a catalog job its scope, kind and pages. */
const PlaylistConfig = z.object({ playlistId: z.number(), dryRun: z.boolean(), prune: z.boolean() });
const CatalogConfig = z.object({
  scope: z.enum(["trending", "popular"]),
  kind: z.enum(["movie", "tv"]),
  pages: z.number(),
});

export const JobSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.enum(["playlist", "catalog"]),
  enabled: z.boolean(),
  /** `6h`, `30m`, `24h` or `off`. */
  schedule: z.string(),
  config: z.union([PlaylistConfig, CatalogConfig]),
  playlistName: z.string().optional(),
  running: z.boolean(),
  lastRunAt: z.number().optional(),
  lastOutcome: z.string().optional(),
  lastCounts: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.number(),
});

export const JobListSchema = z.object({ items: z.array(JobSchema) });

export type AdminJob = z.infer<typeof JobSchema>;
export type JobList = z.infer<typeof JobListSchema>;
