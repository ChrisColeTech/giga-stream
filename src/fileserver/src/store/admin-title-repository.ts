import { z } from "zod";

import type { AdminResult } from "../services/admin-failure.js";
import { badResponse, titleNotFound, unreachable } from "../services/admin-failure.js";
import type { CatalogItem, GenreEntry } from "../types/cached-title.js";
import type { TitleSource } from "../types/library.js";
import type { AdminDatabase } from "./admin-database.js";

export type TitleKind = "movie" | "tv";
export type TitleSort = "newest" | "oldest" | "az" | "year" | "trending";

export interface StoredTitleView {
  id: string;
  kind: TitleKind;
  title: string;
  genres: string[];
  year?: number;
  rating?: number;
  posterUrl?: string;
  backdropUrl?: string;
  plot?: string;
  cast?: string[];
  runtimeMs?: number;
  seasons?: unknown;
  streamUrl?: string;
  tmdbId?: number;
  sources?: TitleSource[];
}

export interface StoredEpisode {
  season: number;
  episode: number;
  title?: string;
  airDate?: string;
  runtimeMs?: number;
  stillUrl?: string;
  streamUrl?: string;
}

const TitleRow = z.object({
  id: z.string(), kind: z.enum(["movie", "tv"]), tmdb_id: z.coerce.number().nullable(),
  payload: z.string(), popularity_score: z.coerce.number().nullable(),
});
const GenreRow = z.object({ genre_id: z.coerce.number().int(), name: z.string() });
const Payload = z.object({
  title: z.string().min(1), genres: z.array(z.string()).default([]), year: z.number().optional(),
  rating: z.number().optional(), posterUrl: z.string().optional(), backdropUrl: z.string().optional(),
  plot: z.string().optional(), cast: z.array(z.string()).optional(), runtimeMs: z.number().optional(),
  seasons: z.unknown().optional(), streamUrl: z.string().optional(),
}).passthrough();
const EpisodeRow = z.object({
  season: z.number().int(), episode: z.number().int(), title: z.string().optional(),
  airDate: z.string().optional(), runtimeMs: z.number().optional(), stillUrl: z.string().optional(),
  streamUrl: z.string().optional(),
});

const COLUMNS = "id, kind, tmdb_id, payload, popularity_score";

function viewOf(raw: unknown): StoredTitleView | undefined {
  const row = TitleRow.safeParse(raw);
  if (!row.success) return undefined;
  let decoded: unknown;
  try { decoded = JSON.parse(row.data.payload); } catch { return undefined; }
  const payload = Payload.safeParse(decoded);
  if (!payload.success) return undefined;
  const p = payload.data;
  return {
    id: row.data.id, kind: row.data.kind, title: p.title, genres: p.genres,
    ...(row.data.tmdb_id !== null && { tmdbId: row.data.tmdb_id }),
    ...(p.year !== undefined && { year: p.year }), ...(p.rating !== undefined && { rating: p.rating }),
    ...(p.posterUrl !== undefined && { posterUrl: p.posterUrl }),
    ...(p.backdropUrl !== undefined && { backdropUrl: p.backdropUrl }),
    ...(p.plot !== undefined && { plot: p.plot }), ...(p.cast !== undefined && { cast: p.cast }),
    ...(p.runtimeMs !== undefined && { runtimeMs: p.runtimeMs }),
    ...(p.seasons !== undefined && { seasons: p.seasons }),
    ...(p.streamUrl !== undefined && { streamUrl: p.streamUrl }),
  };
}

/** Authoritative title reads over the backend's schema, never its HTTP API (docs/64 section 2). */
export function createAdminTitleRepository(database: AdminDatabase) {
  async function enabled(id: string): Promise<StoredTitleView | undefined> {
    const result = await database.execute({
      sql: `SELECT ${COLUMNS} FROM titles WHERE id = ? AND enabled = 1`, args: [id],
    });
    return viewOf(result.rows[0]);
  }
  return {
    async genres(kind: TitleKind): Promise<AdminResult<GenreEntry[]>> {
      try {
        const rows = await database.execute({
          sql: "SELECT genre_id, name FROM title_genres WHERE kind = ? ORDER BY name, genre_id", args: [kind],
        });
        return { ok: true, value: rows.rows.map((raw) => {
          const row = GenreRow.parse(raw); return { id: row.genre_id, name: row.name };
        }) };
      } catch { return { ok: false, failure: unreachable }; }
    },
    async page(
      after: string | undefined,
      limit: number,
    ): Promise<AdminResult<{ items: CatalogItem[]; next?: string }>> {
      let result;
      try {
        result = await database.execute({
          sql: `SELECT ${COLUMNS} FROM titles WHERE enabled = 1 ${after === undefined ? "" : "AND id > ?"}
            ORDER BY id LIMIT ?`, args: after === undefined ? [limit + 1] : [after, limit + 1],
        });
      } catch { return { ok: false, failure: unreachable }; }
      try {
        const more = result.rows.length > limit;
        const rows = more ? result.rows.slice(0, limit) : result.rows;
        const views = rows.map(viewOf);
        const items = views.flatMap((view, index): CatalogItem[] => {
          if (view === undefined) return [];
          const raw = TitleRow.parse(rows[index]);
          return [{
            id: view.id, kind: view.kind, title: view.title, genres: view.genres,
            ...(view.year !== undefined && { year: view.year }),
            ...(view.rating !== undefined && { rating: view.rating }),
            ...(raw.popularity_score !== null && { popularity: raw.popularity_score }),
            ...(view.posterUrl !== undefined && { posterUrl: view.posterUrl }),
            ...(view.backdropUrl !== undefined && { backdropUrl: view.backdropUrl }),
          }];
        });
        const last = rows.at(-1);
        const next = more && last !== undefined ? TitleRow.parse(last).id : undefined;
        return { ok: true, value: { items, ...(next !== undefined && { next }) } };
      } catch { return { ok: false, failure: badResponse }; }
    },
    async detail(id: string): Promise<AdminResult<StoredTitleView>> {
      try {
        const row = await enabled(id);
        return row ? { ok: true, value: row } : { ok: false, failure: titleNotFound };
      }
      catch { return { ok: false, failure: unreachable }; }
    },
    async season(id: string, season: number): Promise<AdminResult<{ episodes: StoredEpisode[] }>> {
      try {
        const row = await enabled(id);
        if (row === undefined || row.kind !== "tv") return { ok: false, failure: titleNotFound };
        const seasons = Array.isArray(row.seasons) ? row.seasons : [];
        const found = seasons.find((entry) =>
          z.object({ season: z.number() }).safeParse(entry).data?.season === season);
        const parsed = z.object({ episodes: z.array(EpisodeRow).default([]) }).safeParse(found ?? {});
        return parsed.success ? { ok: true, value: parsed.data } : { ok: false, failure: badResponse };
      } catch { return { ok: false, failure: unreachable }; }
    },
    async related(id: string, limit: number): Promise<AdminResult<StoredTitleView[]>> {
      try {
        const row = await enabled(id);
        if (row === undefined) return { ok: false, failure: titleNotFound };
        const result = await database.execute({
          sql: `SELECT ${COLUMNS} FROM titles o WHERE o.kind = ? AND o.id <> ? AND o.enabled = 1
            AND EXISTS (SELECT 1 FROM json_each(o.payload, '$.genres') og
              JOIN json_each((SELECT json_extract(payload, '$.genres') FROM titles WHERE id = ?)) mg
              ON og.value = mg.value) ORDER BY o.popularity_score DESC, o.id LIMIT ?`,
          args: [row.kind, id, id, limit],
        });
        return { ok: true, value: result.rows.flatMap((raw) => viewOf(raw) ?? []) };
      } catch { return { ok: false, failure: unreachable }; }
    },
  };
}

export type AdminTitleRepository = ReturnType<typeof createAdminTitleRepository>;
