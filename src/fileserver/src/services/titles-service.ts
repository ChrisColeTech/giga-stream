import { z } from "zod";

import { CAST_MAX, RELATED_MAX } from "../constants/titles.js";
import { AppError } from "../lib/app-error.js";
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
import type { LibraryItems } from "./library-items.js";
import type { TitleSession } from "./title-session.js";

const SeasonEntry = z.object({
  season: z.number(),
  episodes: z.array(z.unknown()).optional(),
  episodeCount: z.number().optional(),
});

/** The failure vocabulary of every title read, as the routes answer it (docs/03 section 3.6). */
function failureOf(failure: AdminFailure): AppError {
  return new AppError(failure.code, failure.status, failure.message);
}

/**
 * The titles pass-through (docs/03 section 3.6): the backend's answers with every image address
 * rewritten through the cache (3.11), the active providers attached, and the session's title
 * details kept in memory. Nothing is stored.
 */
export function createTitlesService(deps: {
  admin: AdminTitles;
  adminUrl: () => string;
  session: TitleSession;
  items: LibraryItems;
  rewriteImageUrl: (source: string) => string;
}) {
  const { admin, adminUrl, session, items, rewriteImageUrl } = deps;

  /** Every image address the fileserver passes on goes through the cache (03 section 3.11). */
  const image = (source: string): string => rewriteImageUrl(source);

  /**
   * The seasons the backend's payload carries (7.4): a season's count is the episodes the backend
   * holds for it; the count exists only after its episodes were read.
   */
  function seasonsOf(payload: unknown): Array<{ season: number; episodeCount: number }> {
    if (!Array.isArray(payload)) return [];
    const seasons: Array<{ season: number; episodeCount: number }> = [];
    for (const entry of payload) {
      const row = SeasonEntry.safeParse(entry);
      if (!row.success) continue;
      const count = row.data.episodes?.length ?? row.data.episodeCount;
      if (count !== undefined) seasons.push({ season: row.data.season, episodeCount: count });
    }
    return seasons;
  }

  function detailOfRow(row: BackendTitle): TitleDetail {
    const seasons = seasonsOf(row.seasons);
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
    };
  }

  async function fetchDetail(titleId: string): Promise<TitleDetail> {
    const answer = await admin.titleDetail(adminUrl(), titleId);
    if (!answer.ok) {
      session.noteTitleRead(answer.failure.code !== "title.not_found");
      throw failureOf(answer.failure);
    }
    session.noteTitleRead(true);
    const detail = detailOfRow(answer.value);
    session.rememberDetail(detail.id, detail);
    return detail;
  }

  /** At most 20 rows, the basis title itself never among them (`06` section 5.5). */
  async function relatedItems(rows: readonly BackendTitle[], basisId: string): Promise<LibraryItem[]> {
    const kept = rows.filter((row) => row.id !== basisId).slice(0, RELATED_MAX);
    return Promise.all(kept.map((row) => items.titleItem(row)));
  }

  /** The fallback lanes over the catalog (03 section 3.6, `11` section 4). */
  async function fallbackRelated(facts: TitleDetail, basisId: string): Promise<RelatedAnswer> {
    const genre = facts.genres[0];
    const lanes: Array<{ basis: RelatedBasis; genre?: string; year?: number }> = [];
    if (genre !== undefined && facts.year !== undefined) lanes.push({ basis: "genre-year", genre, year: facts.year });
    if (genre !== undefined) lanes.push({ basis: "genre", genre });
    if (facts.year !== undefined) lanes.push({ basis: "year", year: facts.year });
    for (const lane of lanes) {
      const view = await session.genreView(facts.kind);
      const genreId = lane.genre === undefined ? undefined : view?.byName.get(lane.genre);
      const page = await admin.titles(adminUrl(), {
        kind: facts.kind,
        sort: "trending",
        ...(genreId !== undefined && { genre: genreId }),
        ...(lane.year !== undefined && { year: lane.year }),
        page: 1,
      });
      if (!page.ok) {
        session.noteTitleRead(page.failure.code !== "title.not_found");
        throw failureOf(page.failure);
      }
      const rows = page.value.items.filter((row) => row.id !== basisId);
      if (rows.length > 0) return { basis: lane.basis, items: await relatedItems(rows, basisId) };
    }
    return { basis: lanes.at(-1)?.basis ?? "tmdb", items: [] };
  }

  return {
    /** `GET /api/titles/:titleId` (docs/03 section 3.6). */
    async detail(titleId: string): Promise<TitleAnswer> {
      const detail = await fetchDetail(titleId);
      const providers = await session.activeProviders();
      return providers === undefined ? detail : { ...detail, providers };
    },

    /** `GET /api/titles/:titleId/seasons/:season` (docs/03 section 3.6), in episode order. */
    async season(titleId: string, seasonNumber: number): Promise<SeasonAnswer> {
      const answer = await admin.titleSeason(adminUrl(), titleId, seasonNumber);
      if (!answer.ok) {
        session.noteTitleRead(answer.failure.code !== "title.not_found");
        throw failureOf(answer.failure);
      }
      session.noteTitleRead(true);
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
        }));
      const providers = await session.activeProviders();
      return providers === undefined ? { episodes } : { episodes, providers };
    },

    /** `GET /api/titles/:titleId/related` (docs/03 section 3.6, `06` section 5.5). */
    async related(titleId: string): Promise<RelatedAnswer> {
      const recommended = await admin.titleRecommendations(adminUrl(), titleId);
      if (!recommended.ok) {
        session.noteTitleRead(recommended.failure.code !== "title.not_found");
        throw failureOf(recommended.failure);
      }
      session.noteTitleRead(true);
      if (recommended.value.items.length > 0) {
        return { basis: "tmdb", items: await relatedItems(recommended.value.items, titleId) };
      }
      const facts = session.heldDetail(titleId) ?? (await fetchDetail(titleId));
      return fallbackRelated(facts, titleId);
    },

    /**
     * A list row's card facts (03 section 3.5): held for the session, or one bounded fetch; a
     * failed read degrades the row to a skeleton, never the page.
     */
    async cardFacts(titleId: string): Promise<TitleDetail | undefined> {
      const held = session.heldDetail(titleId);
      if (held !== undefined) return held;
      try {
        return await fetchDetail(titleId);
      } catch {
        return undefined;
      }
    },
  };
}

export type TitlesService = ReturnType<typeof createTitlesService>;
