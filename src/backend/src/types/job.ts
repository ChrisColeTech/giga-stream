import { z } from "zod";

import type { CatalogJobConfig, PlaylistJobConfig } from "../store/job-repository.js";

const SCHEDULE_MAX = 20;
const name = z.string().trim().min(1).max(120);
/** `"6h"`, `"30m"`, `"24h"` or `"off"`; the service checks it as `parseSchedule` does. */
const schedule = z.string().trim().max(SCHEDULE_MAX);

const PlaylistConfigSchema = z
  .object({ playlistId: z.number().int().positive(), dryRun: z.boolean().optional(), prune: z.boolean().optional() })
  .strict();
const CatalogConfigSchema = z
  .object({
    scope: z.enum(["trending", "popular"]),
    kind: z.enum(["movie", "tv"]),
    pages: z.number().int().min(1).max(25).optional(),
  })
  .strict();

/** `POST /api/jobs`, discriminated by `type`. */
export const JobInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("playlist"), name, enabled: z.boolean().optional(), schedule: schedule.optional(),
    config: PlaylistConfigSchema,
  }).strict(),
  z.object({
    type: z.literal("catalog"), name, enabled: z.boolean().optional(), schedule: schedule.optional(),
    config: CatalogConfigSchema,
  }).strict(),
]);
export type JobInput = z.infer<typeof JobInputSchema>;

/**
 * `PATCH /api/jobs/:id`: any of these; a `config` change is checked against the job's own type by the service
 * (its `type` never changes).
 */
export const JobPatchSchema = z
  .object({
    name: name.optional(),
    enabled: z.boolean().optional(),
    schedule: schedule.optional(),
    config: z.record(z.unknown()).optional(),
  })
  .strict();
export type JobPatch = z.infer<typeof JobPatchSchema>;

/** `POST /api/jobs/:id/run`: a playlist job's run may override its `dryRun` and `prune` once. */
export const JobRunSchema = z.object({ dryRun: z.boolean().optional(), prune: z.boolean().optional() }).strict();
export type JobRun = z.infer<typeof JobRunSchema>;

export { CatalogConfigSchema, PlaylistConfigSchema };
export type { CatalogJobConfig, PlaylistJobConfig };

/** A job as a read answers it. */
export interface JobView {
  id: number;
  name: string;
  type: "playlist" | "catalog";
  enabled: boolean;
  schedule: string;
  config: PlaylistJobConfig | CatalogJobConfig;
  /** A playlist job names its playlist (never its address). */
  playlistName?: string;
  running: boolean;
  lastRunAt?: number;
  lastOutcome?: string;
  lastCounts?: Record<string, unknown>;
  createdAt: number;
}
