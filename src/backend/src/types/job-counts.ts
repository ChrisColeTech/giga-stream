import { z } from "zod";

/**
 * The typed result of a sync run (docs/03 section 7.2c, "Counts contract"). Nothing here is a sentence and no
 * exception message is ever stored: a failure is `{ code }`, and the admin words every result from these numbers.
 * The admin holds its own copy of this schema (the programs never import each other, `01` section 4.2).
 */
const count = z.number().int().min(0);

export const PlaylistCountsSchema = z
  .object({
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
  })
  .strict();
export type PlaylistCounts = z.infer<typeof PlaylistCountsSchema>;

/** The Library fill (docs/47 section 3.1): rows walked, titles given their detail, seasons given their episodes and titles
 *  given an OMDb block this run. A result stored before the details phase (or before OMDb came back) lacks those counts;
 *  they read as zero. */
export const CatalogCountsSchema = z
  .object({
    titles: count,
    detailed: count.default(0),
    seasons: count.default(0),
    enriched: count.default(0),
    /** Stored series that aired an episode in the Library update's window and were refreshed (docs/49); zero for the fill. */
    airing: count.default(0),
    stale: count,
    stopped: z.boolean().optional(),
  })
  .strict();
export type CatalogCounts = z.infer<typeof CatalogCountsSchema>;

/** A failed run of either kind: the `AppError` code, or `internal.failure` for anything unexpected. */
export const FailedCountsSchema = z.object({ code: z.string().min(1) }).strict();
export type FailedCounts = z.infer<typeof FailedCountsSchema>;

export const RunCountsSchema = z.union([PlaylistCountsSchema, CatalogCountsSchema, FailedCountsSchema]);
export type RunCounts = z.infer<typeof RunCountsSchema>;

export const RUN_RESULTS = ["ok", "failed", "stopped"] as const;
export type RunResult = (typeof RUN_RESULTS)[number];
