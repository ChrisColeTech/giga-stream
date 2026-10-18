import { z } from "zod";

import type { CachedTitle, SeasonCount } from "../types/cached-title.js";

/** Every column a read of a cached title needs, plus its genre names as one JSON array (alias `t` is the title). */
export const TITLE_COLUMNS = `t.id, t.kind, t.title, t.year, t.rating, t.popularity, t.poster_url, t.backdrop_url,
  t.plot, t.cast_json, t.runtime_ms, t.seasons_json, t.detail_at,
  (SELECT json_group_array(g.genre) FROM cached_title_genres g WHERE g.title_id = t.id) AS genres_json`;

const Row = z.object({
  id: z.string(),
  kind: z.enum(["movie", "tv"]),
  title: z.string(),
  year: z.number().nullable(),
  rating: z.number().nullable(),
  popularity: z.number().nullable(),
  poster_url: z.string().nullable(),
  backdrop_url: z.string().nullable(),
  plot: z.string().nullable(),
  cast_json: z.string().nullable(),
  runtime_ms: z.number().nullable(),
  seasons_json: z.string().nullable(),
  detail_at: z.number().nullable(),
  genres_json: z.string().nullable(),
});
const Names = z.array(z.string());
const Seasons = z.array(z.object({ season: z.number(), episodeCount: z.number() }));

function jsonOf<S extends z.ZodTypeAny>(schema: S, text: string | null): z.infer<S> | undefined {
  if (text === null) return undefined;
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** One selected row as a cached title; a row that fails its shape is left out rather than failing a page. */
export function cachedTitleOf(raw: unknown): CachedTitle | undefined {
  const parsed = Row.safeParse(raw);
  if (!parsed.success) return undefined;
  const row = parsed.data;
  const genres = [...(jsonOf(Names, row.genres_json) ?? [])].sort((a, b) => a.localeCompare(b));
  const cast = jsonOf(Names, row.cast_json);
  const seasons: SeasonCount[] | undefined = jsonOf(Seasons, row.seasons_json);
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    genres,
    ...(row.year !== null && { year: row.year }),
    ...(row.rating !== null && { rating: row.rating }),
    ...(row.popularity !== null && { popularity: row.popularity }),
    ...(row.poster_url !== null && { posterUrl: row.poster_url }),
    ...(row.backdrop_url !== null && { backdropUrl: row.backdrop_url }),
    ...(row.plot !== null && { plot: row.plot }),
    ...(cast !== undefined && { cast }),
    ...(row.runtime_ms !== null && { runtimeMs: row.runtime_ms }),
    ...(seasons !== undefined && { seasons }),
    ...(row.detail_at !== null && { detailAt: row.detail_at }),
  };
}

/** The rows of a statement as cached titles. */
export function cachedTitlesOf(raws: readonly unknown[]): CachedTitle[] {
  return raws.flatMap((raw) => cachedTitleOf(raw) ?? []);
}
