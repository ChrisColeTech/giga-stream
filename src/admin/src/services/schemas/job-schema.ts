import { z } from "zod";
import { lastCounts, lastResult } from "./run-counts-schema";

/* `JobView` (`03` section 7.2c, `43` section 3.1): a playlist job is part of its playlist - it names the playlist and its
 * config is `{ playlistId }`; a catalog job carries its scope, kind (not on a discover job) and pages. A playlist job's
 * name is `Sync <playlist name>`, built by the backend at read time. The last run is typed: `lastResult` and
 * `lastCounts`, never a sentence. */
const PlaylistConfig = z.object({ playlistId: z.number() });
const CatalogConfig = z.object({
  scope: z.enum(["trending", "popular", "discover"]),
  kind: z.enum(["movie", "tv"]).optional(),
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
  playlistId: z.number().optional(),
  playlistName: z.string().optional(),
  running: z.boolean(),
  lastRunAt: z.number().optional(),
  lastResult,
  lastCounts,
  createdAt: z.number(),
});

export const JobListSchema = z.object({ items: z.array(JobSchema) });

/** The list as the service reads it, row by row (`01` section 8): an unreadable row is dropped and counted. */
export const JobListLenientSchema = z.object({ items: z.array(z.unknown()) });

export const JobDeletedSchema = z.object({ id: z.number() });

export type AdminJob = z.infer<typeof JobSchema>;
export type PlaylistJobConfig = z.infer<typeof PlaylistConfig>;
export type CatalogJobConfig = z.infer<typeof CatalogConfig>;

/** The readable jobs and how many rows could not be read. */
export interface JobList {
  readonly items: AdminJob[];
  readonly unreadable: number;
}
