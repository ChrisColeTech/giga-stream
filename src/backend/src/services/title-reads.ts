import { AppError, ERRORS } from "../constants/errors.js";
import { RECOMMENDATIONS_MAX } from "../constants/limits.js";
import type { Store } from "../store/store.js";
import type { StoredTitle } from "../store/title-repository.js";
import { withoutEpisodes } from "./title-episodes.js";
import { viewOf } from "./title-overlay.js";
import { type Kind, asRecord, listOf, num, parseTitleId, storedRowOf } from "./title-shapes.js";

const notFound = (titleId: string): AppError => new AppError(ERRORS.titleNotFound, { titleId });

/**
 * The public title reads (docs/47 section 3.2): the store and nothing else. They never call TMDB and never write; a
 * title that is not stored (never synced, or deleted) is `404 title.not_found`, as is a disabled one unless an admin
 * asks. The sync (`title-sync.ts`) is what fills the store.
 */
export function createTitleReads(store: Store) {
  /** The stored synced title behind `titleId`, or 404. */
  async function find(
    titleId: string,
    includeDisabled: boolean,
  ): Promise<{ row: StoredTitle; kind: Kind; tmdbId: number }> {
    const [kind, tmdbId] = parseTitleId(titleId);
    const row = await store.titles.find(kind, tmdbId);
    if (row === undefined || (!row.enabled && !includeDisabled)) throw notFound(titleId);
    return { row, kind, tmdbId };
  }

  return {
    find,

    /** The stored payload (list or detail shape) with the record's facts; a series shows season counts, not episodes. */
    detail: async (titleId: string, includeDisabled: boolean): Promise<Record<string, unknown>> => {
      const { row, kind, tmdbId } = await find(titleId, includeDisabled);
      const payload = storedRowOf(kind, tmdbId, row.payload, row.popularityReadAt ?? row.fetchedAt);
      if (payload === undefined) throw notFound(titleId);
      const { listSnapshot: _snapshot, ...shown } = payload;
      return viewOf({ ...row, payload: withoutEpisodes(shown) }, includeDisabled);
    },

    /** The stored episodes of one season of a series; none stored (or no such season) answers an empty list. */
    episodes: async (titleId: string, season: number, includeDisabled: boolean): Promise<{ episodes: unknown[] }> => {
      const { row, kind } = await find(titleId, includeDisabled);
      if (kind !== "tv") throw notFound(titleId);
      const stored = listOf(asRecord(row.payload).seasons).map(asRecord).find((s) => num(s.season) === season);
      return { episodes: listOf(stored?.episodes) };
    },

    /** From the store: same kind, a shared genre, most popular first, the title left out. */
    recommendations: async (
      titleId: string,
      includeDisabled: boolean,
    ): Promise<{ items: Record<string, unknown>[] }> => {
      const { row } = await find(titleId, includeDisabled);
      const items = (await store.titles.recommendations(row, RECOMMENDATIONS_MAX)).map((other) => {
        const { seasons: _seasons, listSnapshot: _snapshot, ...shown } = viewOf(other, false);
        return shown;
      });
      return { items };
    },

    /** The stored genre dictionary; empty until a Library fill has run. */
    genres: async (kind: Kind): Promise<{ id: number; name: string }[]> => store.titles.genres(kind),
  };
}

export type TitleReads = ReturnType<typeof createTitleReads>;
