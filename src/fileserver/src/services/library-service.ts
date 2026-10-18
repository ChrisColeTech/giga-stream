import { AppError } from "../lib/app-error.js";
import type { LibraryQuery } from "../lib/library-query.js";
import type { CollectionRepository } from "../store/collection-repository.js";
import type { ContinuePage, LibraryPage, LibraryRefreshAnswer } from "../types/library.js";
import type { BackendCacheService } from "./backend-cache-service.js";
import type { LibraryAllView } from "./library-all-view.js";
import type { LibraryLists, ListPage } from "./library-lists.js";

const invalid = (): AppError => new AppError("library.invalid", 422, "That library request cannot be used.");
const collectionMissing = (): AppError => new AppError("collection.not_found", 404, "There is no such collection.");

/**
 * The library query (docs/03 section 3.5, docs/46): every view is answered from the fileserver's own database,
 * the cached titles included. A read checks the titles' freshness first (one indexed row): a cold cache is awaited
 * once, a stale one refreshes in the background while this answer is served. `refresh` forces the sync.
 */
export function createLibraryService(deps: {
  cache: BackendCacheService;
  all: LibraryAllView;
  collections: CollectionRepository;
  lists: LibraryLists;
  /** Whether the cache holds title rows (`titlesAvailable`). */
  titlesAvailable: () => boolean;
}) {
  const { cache, all, collections, lists, titlesAvailable } = deps;

  /** One of the table views; the cached title rows are its card facts. */
  function listView(query: LibraryQuery): LibraryPage {
    if (query.sort === "trending") throw invalid();
    const listed: ListPage =
      query.view === "history"
        ? lists.history(query)
        : query.view === "favorites"
          ? lists.favorites(query)
          : lists.collection(query);
    return {
      items: listed.items,
      ...(listed.nextCursor !== undefined && { nextCursor: listed.nextCursor }),
      total: listed.total,
      facets: listed.facets,
      trending: false,
      titlesAvailable: titlesAvailable(),
    };
  }

  return {
    /** `GET /api/library` (docs/03 section 3.5). */
    async page(query: LibraryQuery): Promise<LibraryPage> {
      if (query.view === "collection") {
        if (query.collectionId === undefined) throw invalid();
        if (collections.findCollection(query.collectionId) === null) throw collectionMissing();
      }
      await cache.ensureFresh("titles");
      return query.view === "all" ? all.page(query) : listView(query);
    },

    /** `GET /api/library/continue` (docs/03 section 3.5, `06` section 4.2). */
    async continuePage(): Promise<ContinuePage> {
      await cache.ensureFresh("titles");
      return { items: lists.continueItems() };
    },

    /** `POST /api/library/refresh` (docs/03 section 5.1): sync the titles now, joining a run in flight. */
    async refresh(): Promise<LibraryRefreshAnswer> {
      const outcome = await cache.refresh("titles");
      if (!outcome.ok) throw new AppError(outcome.failure.code, outcome.failure.status, outcome.failure.message);
      const readAt = cache.rowOf("titles")?.syncedAt ?? undefined;
      return { titlesAvailable: titlesAvailable(), ...(readAt !== undefined && { readAt }) };
    },
  };
}

export type LibraryService = ReturnType<typeof createLibraryService>;
