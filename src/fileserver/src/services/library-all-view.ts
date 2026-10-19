import { LIBRARY_PAGE_SIZE } from "../constants/library.js";
import {
  decodeCursor,
  encodeCursor,
  inList,
  matchesFilters,
  orderRows,
  titleKindsOf,
  yearFacets,
  type LibraryQuery,
} from "../lib/library-query.js";
import { AppError } from "../lib/app-error.js";
import type { LibraryRepository } from "../store/library-repository.js";
import type { LibraryItem, LibraryPage } from "../types/library.js";
import type { LibraryCachedTitles } from "./library-cached-titles.js";
import type { LibraryItems } from "./library-items.js";
import type { LibraryLists } from "./library-lists.js";

const invalid = (): AppError => new AppError("library.invalid", 422, "That library request cannot be used.");

/**
 * `view=all` (docs/03 section 3.5, docs/46 section A): the user's matching files first, then the cached titles.
 * The cursor is `{ localOffset, titleOffset }`, `total` is exact (`locals + cached matches`), and everything is
 * answered from the fileserver's own database: the backend is not asked.
 */
export function createLibraryAllView(deps: {
  repo: LibraryRepository;
  items: LibraryItems;
  lists: LibraryLists;
  cached: LibraryCachedTitles;
  now: () => number;
}) {
  const { repo, items, lists, cached, now } = deps;

  /** The local part: the user's matching files, narrowed and sorted on their own. */
  function localPart(query: LibraryQuery): LibraryItem[] {
    const rows = repo.listLocalFiles().map((row) => ({ item: items.localItem(row), order: { foundAt: row.addedAt } }));
    const kept = rows.filter((row) => inList(row.item, query) && matchesFilters(row.item, query));
    return orderRows(kept, query.sort, (row) => row.order, (row) => row.item.title).map((row) => row.item);
  }

  /** The flags every `all` answer carries; a trending sort the cache cannot serve is refused. */
  function flagsOf(query: LibraryQuery) {
    const kinds = titleKindsOf(query.types);
    const trending = cached.canTrend(kinds);
    if (query.sort === "trending" && !trending) throw invalid();
    return {
      kinds,
      trending,
      titlesAvailable: cached.available(),
      facets: { genres: cached.genres(kinds, query.genres), years: yearFacets(now) },
    };
  }

  /**
   * `watched=watching|watched` (docs/03 section 3.5): the answer is the history's items, not a page of the catalog,
   * so a page is full until the set is exhausted.
   */
  function historyBacked(query: LibraryQuery, state: "watching" | "watched"): LibraryPage {
    const flags = flagsOf(query);
    const listed = lists.watchedSet(query, state);
    return {
      items: listed.items,
      ...(listed.nextCursor !== undefined && { nextCursor: listed.nextCursor }),
      total: listed.total,
      facets: flags.facets,
      trending: flags.trending,
      titlesAvailable: flags.titlesAvailable,
    };
  }

  return {
    page(query: LibraryQuery): LibraryPage {
      if (query.watched === "watching" || query.watched === "watched") return historyBacked(query, query.watched);
      const flags = flagsOf(query);
      const locals = localPart(query);
      const cursor = query.cursor === undefined ? undefined : decodeCursor(query.cursor);
      const localOffset = cursor?.localOffset ?? 0;
      const titleOffset = cursor?.titleOffset ?? 0;
      const localSlice = locals.slice(localOffset, localOffset + LIBRARY_PAGE_SIZE);

      // The cached titles fill what the files leave of the page; their count is asked for every page (it is exact).
      const titles = cached.page(query, flags.kinds, { offset: titleOffset, limit: LIBRARY_PAGE_SIZE - localSlice.length });
      const localsRemain = localOffset + localSlice.length < locals.length;
      const titlesRemain = titleOffset + titles.items.length < titles.total;
      return {
        items: [...localSlice, ...titles.items],
        total: locals.length + titles.total,
        ...((localsRemain || titlesRemain) && {
          nextCursor: encodeCursor({
            localOffset: localOffset + localSlice.length,
            titleOffset: titleOffset + titles.items.length,
          }),
        }),
        facets: flags.facets,
        trending: flags.trending,
        titlesAvailable: flags.titlesAvailable,
      };
    },
  };
}

export type LibraryAllView = ReturnType<typeof createLibraryAllView>;
