import type {
  CatalogCounts, FailedCounts, PlaylistCounts, RunCounts,
} from "@/services/schemas/run-counts-schema";

/* A job's typed `lastCounts` narrowed by its shape (`43` section 3.4, step 6): the backend validates the counts on write
 * and on read, so these are plain checks of which of the three shapes arrived. Pure. */

export const LIST_MAX = 10;

export const playlistCountsOf = (counts: RunCounts | undefined): PlaylistCounts | undefined =>
  counts !== undefined && "created" in counts ? counts : undefined;

export const catalogCountsOf = (counts: RunCounts | undefined): CatalogCounts | undefined =>
  counts !== undefined && "titles" in counts ? counts : undefined;

export const failedCountsOf = (counts: RunCounts | undefined): FailedCounts | undefined =>
  counts !== undefined && "code" in counts ? counts : undefined;

/** The Counts line: `3 created · 12 updated · 0 skipped · 0 refused`, over what the run counted. */
export function countsLine(counts: PlaylistCounts): string {
  const { created, updated, skipped, refused } = counts;
  return [`${created} created`, `${updated} updated`, `${skipped} skipped`, `${refused} refused`].join(" · ");
}

/** The Source line of a playlist run: what the run did about the playlist's own list. */
export const SOURCE_WORDS: Readonly<Record<PlaylistCounts["source"], string>> = {
  file: "File, not read again",
  unchanged: "Web list unchanged",
  updated: "Web list read, changes written",
  unreachable: "Web list unreachable",
};

/** At most ten refusal examples. */
export const refusalsOf = (counts: PlaylistCounts): readonly string[] => counts.refusalExamples.slice(0, LIST_MAX);
