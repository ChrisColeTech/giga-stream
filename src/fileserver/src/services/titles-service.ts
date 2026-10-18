import { RELATED_MAX } from "../constants/titles.js";
import { AppError } from "../lib/app-error.js";
import { decodeGenres } from "../lib/genre-decode.js";
import type { CachedTitleQuery } from "../store/cached-title-query.js";
import type { CachedTitleRepository } from "../store/cached-title-repository.js";
import type {
  Episode,
  LibraryItem,
  RelatedAnswer,
  RelatedBasis,
  SeasonAnswer,
  TitleAnswer,
  TitleDetail,
} from "../types/library.js";
import type { AdminFailure } from "./admin-client.js";
import type { AdminTitles, BackendEpisode, BackendTitle } from "./admin-titles.js";
import type { BackendCacheService } from "./backend-cache-service.js";
import type { LibraryItems } from "./library-items.js";
import { cachedDetailOf, detailWriteOf, liveDetailOf, seasonsOf } from "./title-detail-views.js";

/** The failure vocabulary of every title read, as the routes answer it (docs/03 section 3.6). */
function failureOf(failure: AdminFailure): AppError {
  return new AppError(failure.code, failure.status, failure.message);
}

/**
 * The titles routes (docs/03 section 3.6, docs/46). A detail is read live first, because it carries the Player's
 * `sources` and `streamUrl` (never stored); its display fields are written through to the cache. With the backend
 * unreachable (or the title gone from it) the cache answers without sources. Seasons and related stay live.
 */
export function createTitlesService(deps: {
  admin: AdminTitles;
  adminUrl: () => string;
  cache: BackendCacheService;
  titles: CachedTitleRepository;
  query: CachedTitleQuery;
  items: LibraryItems;
  rewriteImageUrl: (source: string) => string;
  now: () => number;
}) {
  const { admin, adminUrl, cache, titles, query, items, rewriteImageUrl: image, now } = deps;

  /** A title route is a page read: check freshness, never wait for a cold sync (the Player must not stall). */
  const touch = (): Promise<void> => cache.ensureFresh("titles", { awaitCold: false });

  async function detail(titleId: string): Promise<TitleAnswer> {
    await touch();
    const answer = await admin.titleDetail(adminUrl(), titleId);
    if (answer.ok) {
      const row = answer.value;
      const seasons = seasonsOf(row.seasons);
      try {
        titles.writeDetail(detailWriteOf(row, decodeGenres(row.genres, titles.genreNames(row.kind)), seasons, now()));
      } catch {
        // A failed write-through costs the cache one refresh of this title; the live answer is still right.
      }
      return liveDetailOf(row, seasons, image);
    }
    const held = titles.get(titleId);
    if (held !== undefined) return cachedDetailOf(held, image);
    throw failureOf(answer.failure);
  }

  /** The recommended rows as cards, their genre ids decoded through the cached dictionaries. */
  function relatedItems(rows: readonly BackendTitle[], basisId: string): LibraryItem[] {
    const dictionary = { movie: titles.genreNames("movie"), tv: titles.genreNames("tv") };
    return rows
      .filter((row) => row.id !== basisId)
      .slice(0, RELATED_MAX)
      .map((row) => items.titleItem({ ...row, genres: decodeGenres(row.genres, dictionary[row.kind]) }));
  }

  /** The fallback lanes over the cached titles (03 section 3.6): genre and year, then genre, then year. */
  function fallbackRelated(facts: TitleDetail): RelatedAnswer {
    const genre = facts.genres[0];
    const lanes: Array<{ basis: RelatedBasis; genre?: string; year?: number }> = [];
    if (genre !== undefined && facts.year !== undefined) lanes.push({ basis: "genre-year", genre, year: facts.year });
    if (genre !== undefined) lanes.push({ basis: "genre", genre });
    if (facts.year !== undefined) lanes.push({ basis: "year", year: facts.year });
    for (const lane of lanes) {
      const found = query.page({
        kinds: [facts.kind],
        genres: lane.genre === undefined ? [] : [lane.genre],
        unwatched: false,
        sort: "trending",
        offset: 0,
        limit: RELATED_MAX + 1,
        ...(lane.year !== undefined && { year: lane.year }),
      });
      const rows = found.rows.filter((row) => row.id !== facts.id).slice(0, RELATED_MAX);
      if (rows.length > 0) return { basis: lane.basis, items: rows.map((row) => items.titleItem(row)) };
    }
    return { basis: lanes.at(-1)?.basis ?? "tmdb", items: [] };
  }

  return {
    /** `GET /api/titles/:titleId` (docs/03 section 3.6): live first, written through, the cache when offline. */
    detail,

    /** `GET /api/titles/:titleId/seasons/:season` (docs/03 section 3.6), in episode order. */
    async season(titleId: string, seasonNumber: number): Promise<SeasonAnswer> {
      await touch();
      const answer = await admin.titleSeason(adminUrl(), titleId, seasonNumber);
      if (!answer.ok) throw failureOf(answer.failure);
      const episodes: Episode[] = [...answer.value.episodes]
        .sort((a: BackendEpisode, b: BackendEpisode) => a.episode - b.episode)
        .map((row) => ({
          season: row.season,
          episode: row.episode,
          ...(row.title !== undefined && { title: row.title }),
          ...(row.airDate !== undefined && { airDate: row.airDate }),
          ...(row.runtimeMs !== undefined && { runtimeMs: row.runtimeMs }),
          ...(row.stillUrl !== undefined && { stillUrl: image(row.stillUrl) }),
          ...(row.streamUrl !== undefined && { streamUrl: row.streamUrl }),
          ...(row.sources !== undefined && { sources: row.sources }),
        }));
      return { episodes };
    },

    /** `GET /api/titles/:titleId/related` (docs/03 section 3.6, `06` section 5.5). */
    async related(titleId: string): Promise<RelatedAnswer> {
      await touch();
      const recommended = await admin.titleRecommendations(adminUrl(), titleId);
      if (!recommended.ok) throw failureOf(recommended.failure);
      if (recommended.value.items.length > 0) {
        return { basis: "tmdb", items: relatedItems(recommended.value.items, titleId) };
      }
      return fallbackRelated(await detail(titleId));
    },
  };
}

export type TitlesService = ReturnType<typeof createTitlesService>;
