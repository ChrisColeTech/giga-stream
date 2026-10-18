import { z } from "zod";

import type { CatalogJobConfig } from "../store/job-repository.js";
import type { RunCounts, RunResult } from "./job-counts.js";

const SCHEDULE_MAX = 20;
const name = z.string().trim().min(1).max(120);
/** `"6h"`, `"30m"`, `"24h"` or `"off"`; the service checks it as `parseSchedule` does. */
const schedule = z.string().trim().max(SCHEDULE_MAX);

const CatalogConfigSchema = z
  .object({
    scope: z.enum(["trending", "popular", "discover"]),
    /** Not asked for a discover job: the walk covers both kinds (`03` section 7.6b). */
    kind: z.enum(["movie", "tv"]).optional(),
    pages: z.number().int().min(1).max(500).optional(),
  })
  .strict();

/**
 * `POST /api/jobs` creates catalog jobs only (docs/43 section 3.1): a playlist job is part of its playlist and is made
 * by the import that makes the playlist. A `type` other than `catalog` is not a valid body.
 */
export const JobInputSchema = z
  .object({
    type: z.literal("catalog"), name, enabled: z.boolean().optional(), schedule: schedule.optional(),
    config: CatalogConfigSchema,
  })
  .strict();
export type JobInput = z.infer<typeof JobInputSchema>;

/**
 * `PATCH /api/jobs/:id`: any of these; a `config` change is checked against the job's own type by the service
 * (its `type` never changes). A playlist job takes `enabled` and `schedule` only.
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

export { CatalogConfigSchema };
export type { CatalogJobConfig };

/** A job as a read answers it. A playlist job's name is `Sync <playlist name>`, built at read time. */
export interface JobView {
  id: number;
  name: string;
  type: "playlist" | "catalog";
  enabled: boolean;
  schedule: string;
  /** A playlist job's config is `{ playlistId }`; a catalog job's is its scope, kind and pages. */
  config: { playlistId: number } | CatalogJobConfig;
  /** A playlist job names its playlist (never its address). */
  playlistId?: number;
  playlistName?: string;
  running: boolean;
  lastRunAt?: number;
  lastResult?: RunResult;
  lastCounts?: RunCounts;
  createdAt: number;
}
