import { LIBRARY_PAGE_SIZE, UPSTREAM_PAGES_MAX } from "../constants/library.js";
import { matchesFilters, type LibraryQuery } from "../lib/library-query.js";
import type { LibraryItem } from "../types/library.js";
import type { AdminTitles, BackendTitle, TitleKind } from "./admin-titles.js";
import type { LibraryItems } from "./library-items.js";
import type { TitleSession } from "./title-session.js";

/** One backend page over the asked kinds, merged as the backend's own browse merges them (7.4). */
export interface TitlesPage {
  /** False when any kind's read failed; the rows are the kinds that answered. */
  available: boolean;
  rows: BackendTitle[];
  totalPages: number;
  totalResults: number;
}

/** What `read` answers: the matching title items and where reading stopped. */
export interface TitlesRead {
  /** The first upstream page read (its totals), or undefined when no page was read. */
  first: TitlesPage | undefined;
  items: LibraryItem[];
  /** The upstream page the next request starts at; undefined when the catalog is exhausted. */
  nextPage: number | undefined;
  available: boolean;
}

/** The catalog side of `view=all` (docs/03 section 3.5): TMDB's pages browsed through the backend. */
export function createLibraryTitles(deps: {
  admin: AdminTitles;
  adminUrl: () => string;
  session: TitleSession;
  items: LibraryItems;
}) {
  const { admin, adminUrl, session, items } = deps;

  /** One kind's page: TMDB's search with `q`, otherwise its browse narrowed by genre and year. */
  async function kindPage(query: LibraryQuery, kind: TitleKind, page: number): Promise<TitlesPage | undefined> {
    const view = await session.genreView(kind);
    const genreId = query.genres.length === 1 ? view?.byName.get(query.genres[0] ?? "") : undefined;
    const answer =
      query.q !== undefined
        ? await admin.titleSearch(adminUrl(), query.q, kind, page)
        : await admin.titles(adminUrl(), {
            kind,
            sort: query.sort,
            page,
            ...(genreId !== undefined && { genre: genreId }),
            ...(query.year !== undefined && { year: query.year }),
          });
    if (!answer.ok) return undefined;
    return { available: true, rows: answer.value.items, totalPages: answer.value.totalPages, totalResults: answer.value.totalResults };
  }

  /** Both kinds' `page` merged: rows concatenated, the wider page count, the summed totals. */
  async function titlesPage(query: LibraryQuery, kinds: readonly TitleKind[], page: number): Promise<TitlesPage> {
    const answers = await Promise.all(kinds.map((kind) => kindPage(query, kind, page)));
    const pages = answers.reduce<TitlesPage[]>((found, one) => (one === undefined ? found : [...found, one]), []);
    if (pages.length === 0) return { available: false, rows: [], totalPages: 0, totalResults: 0 };
    return {
      available: pages.length === kinds.length,
      rows: pages.flatMap((one) => one.rows),
      totalPages: Math.max(...pages.map((one) => one.totalPages)),
      totalResults: pages.reduce((sum, one) => sum + one.totalResults, 0),
    };
  }

  return {
    /**
     * Reads upstream pages from `start` until `need` rows pass the genre, year and watched filters
     * (applied after the page is cut, so one upstream page may keep few or none), or the catalog ends.
     * Only a page the filters thinned is followed by another read.
     * The read is bounded at `UPSTREAM_PAGES_MAX` upstream pages per request: when the bound is hit the
     * rows found so far are returned (possibly none) with `nextPage` set, so the caller's cursor goes on.
     */
    async read(query: LibraryQuery, kinds: readonly TitleKind[], start: number, need: number): Promise<TitlesRead> {
      const found: LibraryItem[] = [];
      let first: TitlesPage | undefined;
      let available = true;
      let page = start;
      let nextPage: number | undefined;
      for (let read = 0; read < UPSTREAM_PAGES_MAX; read++) {
        const titles = await titlesPage(query, kinds, page);
        first ??= titles;
        available = titles.available;
        const kept = (await Promise.all(titles.rows.map((row) => items.titleItem(row)))).filter((item) =>
          matchesFilters(item, query),
        );
        found.push(...kept);
        nextPage = titles.available && page < titles.totalPages ? page + 1 : undefined;
        // An upstream page the filters left whole is a page as the backend sizes it: no refill.
        const thinned = kept.length < titles.rows.length;
        if (nextPage === undefined || !thinned || found.length >= Math.min(need, LIBRARY_PAGE_SIZE)) break;
        page = nextPage;
      }
      return { first, items: found, nextPage, available };
    },
  };
}

export type LibraryTitles = ReturnType<typeof createLibraryTitles>;
