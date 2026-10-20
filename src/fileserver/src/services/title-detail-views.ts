import { z } from "zod";

import { CAST_MAX } from "../constants/titles.js";
import type { CachedTitle, DetailWrite, SeasonCount } from "../types/cached-title.js";
import type { TitleDetail } from "../types/library.js";
import type { StoredTitleView as BackendTitle } from "../store/admin-title-repository.js";

const SeasonEntry = z.object({
  season: z.number(),
  episodes: z.array(z.unknown()).optional(),
  episodeCount: z.number().optional(),
});

/** The seasons a payload carries (7.4): a count from `episodeCount`, or from the episodes the backend holds. */
export function seasonsOf(payload: unknown): SeasonCount[] {
  if (!Array.isArray(payload)) return [];
  const seasons: SeasonCount[] = [];
  for (const entry of payload) {
    const row = SeasonEntry.safeParse(entry);
    if (!row.success) continue;
    const count = row.data.episodes?.length ?? row.data.episodeCount;
    if (count !== undefined) seasons.push({ season: row.data.season, episodeCount: count });
  }
  return seasons;
}

/** The live answer: every field the backend sent, `sources` and `streamUrl` included (docs/03 section 3.6). */
export function liveDetailOf(row: BackendTitle, seasons: SeasonCount[], image: (source: string) => string): TitleDetail {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    genres: row.genres,
    cast: (row.cast ?? []).slice(0, CAST_MAX),
    ...(row.year !== undefined && { year: row.year }),
    ...(row.plot !== undefined && { plot: row.plot }),
    ...(row.rating !== undefined && { rating: row.rating }),
    ...(row.runtimeMs !== undefined && { runtimeMs: row.runtimeMs }),
    ...(seasons.length > 0 && { seasons }),
    ...(row.posterUrl !== undefined && { posterUrl: image(row.posterUrl) }),
    ...(row.backdropUrl !== undefined && { backdropUrl: image(row.backdropUrl) }),
    ...(row.streamUrl !== undefined && { streamUrl: row.streamUrl }),
    ...(row.sources !== undefined && { sources: row.sources }),
  };
}

/** The cache's answer while the backend cannot give the live one: no `sources`, no `streamUrl`, `fromCache: true`. */
export function cachedDetailOf(row: CachedTitle, image: (source: string) => string): TitleDetail {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    genres: row.genres,
    cast: row.cast ?? [],
    fromCache: true,
    ...(row.year !== undefined && { year: row.year }),
    ...(row.plot !== undefined && { plot: row.plot }),
    ...(row.rating !== undefined && { rating: row.rating }),
    ...(row.runtimeMs !== undefined && { runtimeMs: row.runtimeMs }),
    ...(row.seasons !== undefined && row.seasons.length > 0 && { seasons: row.seasons }),
    ...(row.posterUrl !== undefined && { posterUrl: image(row.posterUrl) }),
    ...(row.backdropUrl !== undefined && { backdropUrl: image(row.backdropUrl) }),
  };
}

/**
 * The display fields of a live detail for the cache (docs/46 section A): named fields only, so a `streamUrl` or
 * `sources` can never follow into a column. Addresses stay the sources; the image rewrite happens at read time.
 */
export function detailWriteOf(row: BackendTitle, genres: string[], seasons: SeasonCount[], at: number): DetailWrite {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    genres,
    cast: (row.cast ?? []).slice(0, CAST_MAX),
    seasons,
    at,
    ...(row.year !== undefined && { year: row.year }),
    ...(row.rating !== undefined && { rating: row.rating }),
    ...(row.posterUrl !== undefined && { posterUrl: row.posterUrl }),
    ...(row.backdropUrl !== undefined && { backdropUrl: row.backdropUrl }),
    ...(row.plot !== undefined && { plot: row.plot }),
    ...(row.runtimeMs !== undefined && { runtimeMs: row.runtimeMs }),
  };
}
