import { z } from "zod";

import type { TitleSource } from "../types/library.js";
import {
  decodeData,
  errorCodeOf,
  fetchAdminJson,
  refusalOf,
  type AdminResult,
} from "./admin-client.js";

export const TITLES_TIMEOUT_MS = 20_000;

/** The kinds the fileserver browses one at a time (docs/03 section 7.4). */
export type TitleKind = "movie" | "tv";
export type TitleSort = "newest" | "oldest" | "az" | "year" | "trending";

/** A backend title row or detail (docs/03 section 7.4): the fields the fileserver passes on. */
export interface BackendTitle {
  id: string;
  kind: TitleKind;
  title: string;
  year?: number;
  /** A detail carries genre names; a list row carries TMDB's genre ids as strings. */
  genres: string[];
  rating?: number;
  posterUrl?: string;
  backdropUrl?: string;
  plot?: string;
  cast?: string[];
  runtimeMs?: number;
  /** A season only after the backend filled its episodes (7.4); mapped defensively. */
  seasons?: unknown;
  streamUrl?: string;
  /** The playable sources the backend filled (7.5), passed through untouched. */
  sources?: TitleSource[];
}

/** One episode as the backend answers it (docs/03 section 7.4). */
export interface BackendEpisode {
  season: number;
  episode: number;
  title?: string;
  airDate?: string;
  runtimeMs?: number;
  stillUrl?: string;
  streamUrl?: string;
  /** This exact episode's playable sources (7.5). */
  sources?: TitleSource[];
}

/** The shape of every list the backend answers (docs/03 section 7.4). */
export interface TitlePage {
  items: BackendTitle[];
  page: number;
  totalPages: number;
  totalResults: number;
}

/** One entry of TMDB's genre list (docs/03 section 7.4). */
export interface BackendGenre {
  id: number;
  name: string;
}

/** One source as the backend fills it (docs/03 section 7.5): the shape every answer must carry. */
const SourceSchema = z.object({
  providerId: z.number(),
  name: z.string(),
  url: z.string(),
  origin: z.string(),
  order: z.number(),
  startParam: z.string().optional(),
  subtitlesParam: z.string().optional(),
  frameOrigins: z.array(z.string()).optional(),
  messageShape: z.enum(["vidsrc-status", "player-event"]).optional(),
});
const SourcesSchema = z.array(SourceSchema).optional();

const TitleSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["movie", "tv"]),
  title: z.string(),
  genres: z.array(z.string()).default([]),
  year: z.number().optional(),
  rating: z.number().optional(),
  posterUrl: z.string().optional(),
  backdropUrl: z.string().optional(),
  plot: z.string().optional(),
  cast: z.array(z.string()).optional(),
  runtimeMs: z.number().optional(),
  seasons: z.unknown().optional(),
  streamUrl: z.string().optional(),
  sources: SourcesSchema,
});
const PageSchema = z.object({
  items: z.array(TitleSchema),
  page: z.number(),
  totalPages: z.number(),
  totalResults: z.number(),
});
const GenresSchema = z.array(z.object({ id: z.number(), name: z.string() }));
const SeasonSchema = z.object({
  episodes: z.array(
    z.object({
      season: z.number(),
      episode: z.number(),
      title: z.string().optional(),
      airDate: z.string().optional(),
      runtimeMs: z.number().optional(),
      stillUrl: z.string().optional(),
      streamUrl: z.string().optional(),
      sources: SourcesSchema,
    }),
  ),
});
const RecommendationsSchema = z.object({ items: z.array(TitleSchema) });

const titleNotFound = { code: "title.not_found", message: "There is no such title.", status: 404 } as const;

export interface AdminTitles {
  /** `GET /api/titles` — one kind's page in the chosen sort, narrowed by genre and year (7.4). */
  titles(
    baseUrl: string,
    query: { kind: TitleKind; sort: TitleSort; genre?: string; year?: number; page: number },
  ): Promise<AdminResult<TitlePage>>;
  /** `GET /api/titles/search` — TMDB's search, people left out. */
  titleSearch(baseUrl: string, q: string, kind: TitleKind, page: number): Promise<AdminResult<TitlePage>>;
  /** `GET /api/titles/genres` — TMDB's genre names for one kind. */
  titleGenres(baseUrl: string, kind: TitleKind): Promise<AdminResult<BackendGenre[]>>;
  /** `GET /api/titles/:titleId` — the detail payload. */
  titleDetail(baseUrl: string, titleId: string): Promise<AdminResult<BackendTitle>>;
  /** `GET /api/titles/:titleId/seasons/:season` — the season's episodes. */
  titleSeason(baseUrl: string, titleId: string, season: number): Promise<AdminResult<{ episodes: BackendEpisode[] }>>;
  /** `GET /api/titles/:titleId/recommendations` — TMDB's recommendations, first page. */
  titleRecommendations(baseUrl: string, titleId: string): Promise<AdminResult<{ items: BackendTitle[] }>>;
}

function withQuery(baseUrl: string, path: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) query.set(key, String(value));
  return `${baseUrl}${path}?${query.toString()}`;
}

/**
 * The titles half of the admin client (docs/03 sections 7.4 and 7.2b): the same one GET, timeout,
 * size cap and failure vocabulary as the channels half, with one extra mapping — the backend's
 * `404 title.not_found` is that same 404 here (03 section 3.6).
 */
export function createAdminTitles(options: { fetch?: typeof fetch } = {}): AdminTitles {
  const doFetch = options.fetch ?? globalThis.fetch;

  async function get<S extends z.ZodTypeAny>(url: string, schema: S): Promise<AdminResult<z.infer<S>>> {
    const answer = await fetchAdminJson(doFetch, url, TITLES_TIMEOUT_MS, undefined);
    if (!answer.ok) return { ok: false, failure: answer.failure };
    if (answer.status < 200 || answer.status >= 300) {
      const refusal =
        answer.status === 404 && errorCodeOf(answer.json) === "title.not_found" ? titleNotFound : refusalOf(answer.status);
      return { ok: false, failure: refusal };
    }
    return decodeData(schema, answer.json);
  }

  return {
    titles: (baseUrl, query) =>
      get(
        withQuery(baseUrl, "/api/titles", {
          kind: query.kind,
          sort: query.sort,
          genre: query.genre,
          year: query.year,
          page: query.page,
        }),
        PageSchema,
      ),
    titleSearch: (baseUrl, q, kind, page) =>
      get(withQuery(baseUrl, "/api/titles/search", { q, kind, page }), PageSchema),
    titleGenres: (baseUrl, kind) => get(withQuery(baseUrl, "/api/titles/genres", { kind }), GenresSchema),
    titleDetail: (baseUrl, titleId) => get(`${baseUrl}/api/titles/${encodeURIComponent(titleId)}`, TitleSchema),
    titleSeason: (baseUrl, titleId, season) =>
      get(`${baseUrl}/api/titles/${encodeURIComponent(titleId)}/seasons/${season}`, SeasonSchema),
    titleRecommendations: (baseUrl, titleId) =>
      get(`${baseUrl}/api/titles/${encodeURIComponent(titleId)}/recommendations`, RecommendationsSchema),
  };
}
