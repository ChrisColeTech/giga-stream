import { LIBRARY_PAGE_SIZE } from "../constants/library.js";
import {
  decodeCursor,
  encodeCursor,
  inList,
  matchesFilters,
  orderRows,
  yearFacets,
  type LibraryQuery,
} from "../lib/library-query.js";
import { AppError } from "../lib/app-error.js";
import type { CollectionRepository } from "../store/collection-repository.js";
import type { LibraryRepository } from "../store/library-repository.js";
import type { ContinuePage, LibraryItem, LibraryPage } from "../types/library.js";
import type { AdminTitles, BackendTitle, TitleKind } from "./admin-titles.js";
import type { LibraryItems } from "./library-items.js";
import type { ListPage, LibraryLists } from "./library-lists.js";
import type { TitleSession } from "./title-session.js";

const invalid = (): AppError => new AppError("library.invalid", 422, "That library request cannot be used.");
const collectionMissing = (): AppError => new AppError("collection.not_found", 404, "There is no such collection.");

/** One backend page over the asked kinds, merged as the backend's own browse merges them (7.4). */
interface TitlesPage {
  /** False when any kind's read failed; the rows are the kinds that answered. */
  available: boolean;
  rows: BackendTitle[];
  totalPages: number;
  totalResults: number;
}

/**
 * The library query (docs/03 section 3.5): `view=all` combines the user's matching files with
 * TMDB's pages browsed through the backend, in the chosen sort, narrowed by genre and year; the
 * other views list the fileserver's own tables. The local parts always answer, whatever the
 * backend does: `titlesAvailable: false` says the title regions are skeletons.
 */
export function createLibraryService(deps: {
  admin: AdminTitles;
  adminUrl: () => string;
  session: TitleSession;
  items: LibraryItems;
  repo: LibraryRepository;
  collections: CollectionRepository;
  lists: LibraryLists;
  now: () => number;
}) {
  const { admin, adminUrl, session, items, repo, collections, lists, now } = deps;

  const kindsOf = (type: LibraryQuery["type"]): TitleKind[] =>
    type === "movie" || type === "tv" ? [type] : type === "all" ? ["movie", "tv"] : [];

  /** The local part of `view=all`: the user's matching files, narrowed and sorted on their own. */
  function localPart(query: LibraryQuery): LibraryItem[] {
    const rows = repo.listLocalFiles().map((row) => ({ item: items.localItem(row), order: { foundAt: row.addedAt } }));
    const kept = rows.filter((row) => inList(row.item, query) && matchesFilters(row.item, query));
    return orderRows(kept, query.sort, (row) => row.order, (row) => row.item.title).map((row) => row.item);
  }

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

  /** `view=all` (docs/03 section 3.5): the matching files first, then the titles. */
  async function allView(query: LibraryQuery): Promise<LibraryPage> {
    const health = await session.health();
    const kinds = kindsOf(query.type);
    const canTrend = health.reachable && health.tmdbConfigured && kinds.length > 0;
    if (query.sort === "trending" && !canTrend) throw invalid();

    const locals = localPart(query);
    const cursor = query.cursor === undefined ? undefined : decodeCursor(query.cursor);
    const localOffset = cursor?.localOffset ?? 0;
    const titlePage = Math.max(1, cursor?.titlePage ?? 1);
    const localSlice = locals.slice(localOffset, localOffset + LIBRARY_PAGE_SIZE);
    const localsRemain = localOffset + localSlice.length < locals.length;

    // The titles are read only when the page has room for them (03 section 3.5).
    const titles =
      kinds.length > 0 && localSlice.length < LIBRARY_PAGE_SIZE ? await titlesPage(query, kinds, titlePage) : undefined;
    const available = titles === undefined ? health.reachable && health.tmdbConfigured : titles.available;
    const pageRows = (await Promise.all((titles?.rows ?? []).map((row) => items.titleItem(row)))).filter((item) =>
      matchesFilters(item, query),
    );

    const moreTitles = titles !== undefined && titles.available && titlePage < titles.totalPages;
    const nextCursor =
      localsRemain || moreTitles
        ? encodeCursor({ localOffset: localOffset + localSlice.length, titlePage: moreTitles ? titlePage + 1 : titlePage })
        : undefined;
    const genreFacets = new Set<string>();
    for (const kind of kinds) {
      const view = await session.genreView(kind);
      if (view !== undefined) for (const name of view.names) genreFacets.add(name);
    }
    const trending = available && health.tmdbConfigured && kinds.length > 0;
    session.noteAvailability({ available, trending });
    // The whole matching count, wherever it is known; TMDB's totals only when they were read
    // whole (03 section 3.5: "when known").
    const total =
      kinds.length === 0
        ? { total: locals.length }
        : titles !== undefined && titles.available && query.watched === "all" && query.genres.length <= 1
          ? { total: locals.length + titles.totalResults }
          : {};
    return {
      items: [...localSlice, ...pageRows],
      ...total,
      ...(nextCursor !== undefined && { nextCursor }),
      facets: { genres: [...genreFacets], years: yearFacets(now) },
      trending,
      titlesAvailable: available,
    };
  }

  /** One of the table views; no backend read is made for the list itself (docs/03 section 3.5). */
  async function listView(query: LibraryQuery): Promise<LibraryPage> {
    if (query.sort === "trending") throw invalid();
    const listed: ListPage =
      query.view === "history"
        ? await lists.history(query)
        : query.view === "favorites"
          ? await lists.favorites(query)
          : await lists.collection(query);
    const availability = session.availability();
    return {
      items: listed.items,
      ...(listed.nextCursor !== undefined && { nextCursor: listed.nextCursor }),
      total: listed.total,
      facets: listed.facets,
      trending: false,
      titlesAvailable: availability.available,
    };
  }

  return {
    /** `GET /api/library` (docs/03 section 3.5). */
    async page(query: LibraryQuery): Promise<LibraryPage> {
      if (query.view === "collection") {
        if (query.collectionId === undefined) throw invalid();
        if (collections.findCollection(query.collectionId) === null) throw collectionMissing();
      }
      return query.view === "all" ? allView(query) : listView(query);
    },

    /** `GET /api/library/continue` (docs/03 section 3.5, `06` section 4.2). */
    async continuePage(): Promise<ContinuePage> {
      return { items: await lists.continueItems() };
    },
  };
}

export type LibraryService = ReturnType<typeof createLibraryService>;
