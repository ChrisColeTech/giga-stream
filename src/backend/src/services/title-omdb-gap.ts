import { type Kind, listOf, str } from "./title-shapes.js";

/** The stored detail fields OMDb may fill (docs/11 section 7.3): each is true when it is a gap OMDb may fill. */
export interface Gaps {
  plot: boolean;
  runtime: boolean;
  genres: boolean;
  /** No `rating` (TMDB's vote_average, absent or 0): OMDb's `imdbRating` fills it. */
  rating: boolean;
}

const blank = (value: unknown): boolean => typeof value !== "string" || value.trim() === "";

/**
 * Which fields of a stored detail OMDb may fill: an empty `plot` (TMDB's overview), no `runtimeMs`, no `genres`,
 * no `rating`. A field an admin edited is never a gap (it is the admin's, even when emptied). Runtime is a movie's:
 * a series' payload carries no runtime (TMDB's series answer has none, only per-episode ones), so its absence is
 * how every series looks and never a gap.
 */
export function gapsOf(kind: Kind, payload: Record<string, unknown>, edited: readonly string[]): Gaps {
  const runtime = payload.runtimeMs;
  return {
    plot: !edited.includes("plot") && blank(payload.plot),
    runtime: kind === "movie" && !edited.includes("runtimeMs") && !(typeof runtime === "number" && runtime > 0),
    genres: !edited.includes("genres") && listOf(payload.genres).length === 0,
    rating: !edited.includes("rating") && !(typeof payload.rating === "number" && payload.rating > 0),
  };
}

export const hasGap = (gaps: Gaps): boolean => gaps.plot || gaps.runtime || gaps.genres || gaps.rating;

const given = (value: unknown): string | undefined => {
  const text = str(value)?.trim();
  return text === undefined || text === "" || text === "N/A" ? undefined : text;
};

/**
 * The payload with OMDb's answer written into its gaps only: `Plot`, `Runtime` ("136 min"), `imdbRating` and
 * `Genre` ("Action, Sci-Fi"), the genres kept only when TMDB's dictionary has the name (case-insensitive, in OMDb's
 * order). A present field is never replaced. Answers the new payload and how many fields were filled.
 */
export function fillGaps(
  payload: Record<string, unknown>, gaps: Gaps, record: Record<string, unknown>, dictionary: readonly string[],
): { payload: Record<string, unknown>; filled: number } {
  const next = { ...payload };
  let filled = 0;
  const plot = given(record.Plot);
  if (gaps.plot && plot !== undefined) [next.plot, filled] = [plot, filled + 1];
  const minutes = Number(/^(\d+)\s*min/.exec(given(record.Runtime) ?? "")?.[1]);
  if (gaps.runtime && minutes > 0) [next.runtimeMs, filled] = [minutes * 60_000, filled + 1];
  const score = Number(given(record.imdbRating));
  if (gaps.rating && score > 0 && score <= 10) [next.rating, filled] = [score, filled + 1];
  if (gaps.genres) {
    const known = new Map(dictionary.map((name) => [name.toLowerCase(), name]));
    const names = (given(record.Genre) ?? "").split(",").flatMap((name) => known.get(name.trim().toLowerCase()) ?? []);
    if (names.length > 0) [next.genres, filled] = [[...new Set(names)], filled + 1];
  }
  return { payload: next, filled };
}
