import { z } from "zod";

/* The typed result of a sync run (`03` section 7.2c, "Counts contract"): the admin's own copy of the backend's schema
 * (the programs never import each other, `01` section 4.2). Nothing here is a sentence and no exception message ever
 * arrives: a failure is `{ code }`, and the admin words every result from these numbers (`lib/run-words.ts`). */
const count = z.number().int().min(0);

export const PlaylistCountsSchema = z.object({
  created: count,
  updated: count,
  skipped: count,
  refused: count,
  source: z.enum(["unchanged", "updated", "file", "unreachable"]),
  logosCached: count,
  logosFailed: count,
  live: count,
  dead: count,
  unchecked: count,
  refusalExamples: z.array(z.string()),
  stopped: z.boolean().optional(),
});

/** The Library fill (`docs/47` section 3.1): `detailed` and `seasons` arrive with the details phase, `enriched` may land
 *  later; a result stored before them lacks them, so each is optional and any other field is ignored. */
export const CatalogCountsSchema = z.object({
  titles: count,
  detailed: count.optional(),
  seasons: count.optional(),
  enriched: count.optional(),
  stale: count,
  stopped: z.boolean().optional(),
});

export const FailedCountsSchema = z.object({ code: z.string().min(1) });

export const RunCountsSchema = z.union([PlaylistCountsSchema, CatalogCountsSchema, FailedCountsSchema]);
export const RunResultSchema = z.enum(["ok", "failed", "stopped"]);

/** An unreadable result is read as absent, never as an error (`03` section 7.2c): the row stays readable. */
export const lastResult = RunResultSchema.optional().catch(undefined);
export const lastCounts = RunCountsSchema.optional().catch(undefined);

export type PlaylistCounts = z.infer<typeof PlaylistCountsSchema>;
export type CatalogCounts = z.infer<typeof CatalogCountsSchema>;
export type FailedCounts = z.infer<typeof FailedCountsSchema>;
export type RunCounts = z.infer<typeof RunCountsSchema>;
export type RunResult = z.infer<typeof RunResultSchema>;
