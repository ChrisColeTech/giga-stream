import type { LibraryQuery } from "../lib/library-query.js";
import type { CachedTitleQuery } from "../store/cached-title-query.js";
import type { CachedTitleRepository } from "../store/cached-title-repository.js";
import type { TitleKind } from "./admin-titles.js";
import type { LibraryItems } from "./library-items.js";
import type { LibraryItem } from "../types/library.js";

/**
 * The titles side of `view=all` (docs/03 section 3.5, docs/46 section A): pages, totals, facets and the trending
 * flag, all answered from the cached titles. Search (`q`) is a `LIKE` over the same rows; nothing here can reach
 * the backend, because nothing here holds a client for it.
 */
export function createLibraryCachedTitles(deps: {
  titles: CachedTitleRepository;
  query: CachedTitleQuery;
  items: LibraryItems;
}) {
  const { titles, query, items } = deps;

  return {
    /** `limit` cards from `offset` over the matching cached titles, and the exact count of all of them. */
    page(
      request: LibraryQuery,
      kinds: readonly TitleKind[],
      paging: { offset: number; limit: number },
    ): { items: LibraryItem[]; total: number } {
      const found = query.page({
        kinds,
        genres: request.genres,
        unwatched: request.watched === "unwatched",
        sort: request.sort,
        offset: paging.offset,
        limit: paging.limit,
        ...(request.q !== undefined && { q: request.q }),
        ...(request.year !== undefined && { year: request.year }),
      });
      return { items: found.rows.map((row) => items.titleItem(row)), total: found.total };
    },

    /** The Genre choices: the genres the cached titles of these kinds carry, a chosen one kept listed. */
    genres(kinds: readonly TitleKind[], chosen: readonly string[]): string[] {
      const names = new Set([...query.genreFacets(kinds), ...chosen]);
      return [...names].sort((a, b) => a.localeCompare(b));
    },

    /** Whether the trending sort can be offered: some cached title of these kinds has a stored popularity. */
    canTrend: (kinds: readonly TitleKind[]): boolean => query.hasPopularity(kinds),

    /** `titlesAvailable`: the cache holds title rows (title regions are skeletons only while it is empty). */
    available: (): boolean => titles.hasAny(),
  };
}

export type LibraryCachedTitles = ReturnType<typeof createLibraryCachedTitles>;
