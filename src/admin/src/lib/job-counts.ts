import type { AdminJob } from "@/services/schemas/job-schema";

/* The defensive reading of a job's `lastCounts` (`38` section 4.3): the backend keeps it as a loose record, so every
 * key is read as `unknown` and kept only when it has the expected shape. An absent or odd key reads as undefined, and
 * the page draws a shimmer line for it, never a sentence. */

export const LIST_MAX = 10;

/** A playlist run's six counts, in the order the page shows them. */
export const PLAYLIST_COUNT_KEYS = ["created", "updated", "kept", "skipped", "refused", "removed"] as const;
export type PlaylistCountKey = (typeof PLAYLIST_COUNT_KEYS)[number];

export interface PlaylistCounts {
  /** Each count present as a number; a missing or odd one is absent. */
  readonly counts: Partial<Readonly<Record<PlaylistCountKey, number>>>;
  /** At most ten refusal sentences; undefined when the key is absent or not a list. */
  readonly refused: readonly string[] | undefined;
  /** At most ten channel ids the run created; undefined when absent. */
  readonly created: readonly string[] | undefined;
}

export interface CatalogCounts {
  readonly titles: number | undefined;
  readonly stale: number | undefined;
}

const countOf = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;

const textsOf = (value: unknown): readonly string[] | undefined =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, LIST_MAX)
    : undefined;

const recordOf = (job: AdminJob): Readonly<Record<string, unknown>> => job.lastCounts ?? {};

export function playlistCounts(job: AdminJob): PlaylistCounts {
  const record = recordOf(job);
  const counts: Partial<Record<PlaylistCountKey, number>> = {};
  for (const key of PLAYLIST_COUNT_KEYS) {
    const value = countOf(record[key]);
    if (value !== undefined) counts[key] = value;
  }
  return { counts, refused: textsOf(record["refusalExamples"]), created: textsOf(record["createdIds"]) };
}

export function catalogCounts(job: AdminJob): CatalogCounts {
  const record = recordOf(job);
  return { titles: countOf(record["titles"]), stale: countOf(record["stale"]) };
}

/** The Counts line: `3 created · 12 updated · ...` over the counts present; undefined when none is. */
export function countsLine(counts: PlaylistCounts["counts"]): string | undefined {
  const parts = PLAYLIST_COUNT_KEYS.flatMap((key) => (counts[key] === undefined ? [] : [`${counts[key]} ${key}`]));
  return parts.length === 0 ? undefined : parts.join(" · ");
}
