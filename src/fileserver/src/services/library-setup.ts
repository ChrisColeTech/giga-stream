import type { CachedTitleQuery } from "../store/cached-title-query.js";
import type { CachedTitleRepository } from "../store/cached-title-repository.js";
import type { CollectionRepository } from "../store/collection-repository.js";
import type { FavoritesRepository } from "../store/favorites-repository.js";
import type { LibraryRepository } from "../store/library-repository.js";
import type { AdminTitleRepository } from "../store/admin-title-repository.js";
import type { BackendCacheService } from "./backend-cache-service.js";
import { createLibraryAllView } from "./library-all-view.js";
import { createLibraryCachedTitles } from "./library-cached-titles.js";
import { createLibraryItems } from "./library-items.js";
import { createLibraryLists } from "./library-lists.js";
import { createLibraryService } from "./library-service.js";
import { createTitlesService } from "./titles-service.js";
import type { TitleSources } from "./title-sources.js";

/** The library and titles services over the cache and the fileserver's own tables (docs/03 sections 3.5, 3.6; docs/46). */
export function createLibrary(deps: {
  cache: BackendCacheService;
  cachedTitles: CachedTitleRepository;
  titleQuery: CachedTitleQuery;
  titlesAdmin: AdminTitleRepository;
  titleSources: TitleSources;
  adminUrl: () => string;
  libraryRepo: LibraryRepository;
  favorites: FavoritesRepository;
  collections: CollectionRepository;
  rewriteImageUrl: (source: string) => string;
  now: () => number;
}) {
  const { cache, cachedTitles, titleQuery, libraryRepo, now } = deps;
  const items = createLibraryItems({
    favorites: deps.favorites,
    newestEntry: (kind, itemId) => libraryRepo.newestWatchEntry(kind, itemId),
    rewriteImageUrl: deps.rewriteImageUrl,
  });
  const titles = createTitlesService({
    admin: deps.titlesAdmin,
    sources: deps.titleSources,
    adminUrl: deps.adminUrl,
    cache,
    titles: cachedTitles,
    query: titleQuery,
    items,
    rewriteImageUrl: deps.rewriteImageUrl,
    now,
  });
  const lists = createLibraryLists({ repo: libraryRepo, items, titles: cachedTitles });
  const library = createLibraryService({
    cache,
    all: createLibraryAllView({
      repo: libraryRepo,
      items,
      lists,
      cached: createLibraryCachedTitles({ titles: cachedTitles, query: titleQuery, items }),
      now,
    }),
    collections: deps.collections,
    lists,
    titlesAvailable: () => cachedTitles.hasAny(),
  });
  return { titles, library };
}
