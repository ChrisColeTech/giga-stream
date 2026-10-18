import type { ItemKind } from "../store/collection-repository.js";
import type { FavoritesRepository } from "../store/favorites-repository.js";
import type { LibraryFileRow, LibraryWatchRow } from "../store/library-repository.js";
import { localDisplayTitle } from "../store/local-file-repository.js";
import type { LibraryItem } from "../types/library.js";
import type { TitleKind } from "./admin-titles.js";

/** One watch entry as a row's progress (docs/03 section 3.5). */
export function progressOf(entry: LibraryWatchRow): NonNullable<LibraryItem["progress"]> {
  return {
    positionMs: entry.positionMs,
    ...(entry.durationMs !== undefined && { durationMs: entry.durationMs }),
    state: entry.state,
    ...(entry.season !== undefined && { season: entry.season }),
    ...(entry.episode !== undefined && { episode: entry.episode }),
  };
}

/** The facts a title card is made of: a cached row, or a backend row whose genres were decoded. */
export interface TitleFacts {
  id: string;
  kind: TitleKind;
  title: string;
  genres: readonly string[];
  year?: number;
  rating?: number;
  /** An image source address; the card carries its image-cache address. */
  posterUrl?: string;
}

/**
 * The library's row builders (docs/03 section 3.5): the local and title facts every view's cards
 * are made of. A local row's poster is its still's image-cache address; a title row's poster goes
 * through the cache's one rewrite. Nothing here reads the backend.
 */
export function createLibraryItems(deps: {
  favorites: FavoritesRepository;
  newestEntry: (kind: ItemKind, itemId: string) => LibraryWatchRow | null;
  rewriteImageUrl: (source: string) => string;
}) {
  const { favorites, newestEntry, rewriteImageUrl } = deps;

  const withProgress = (item: LibraryItem, entry: LibraryWatchRow | null): LibraryItem => {
    const progress = entry === null ? undefined : progressOf(entry);
    return progress === undefined ? item : { ...item, progress };
  };

  /** A local file's row (03 section 3.5): the display name, the still, quality from the height. */
  const localItem = (row: LibraryFileRow): LibraryItem =>
    withProgress(
      {
        ref: { kind: "local", id: row.id },
        kind: "local",
        title: localDisplayTitle(row.title, ""),
        genres: [],
        favorite: favorites.isFavorite("local", row.id),
        ...(row.posterId !== undefined && { posterUrl: `/api/images/${row.posterId}` }),
        ...(row.height !== undefined && { quality: `${row.height}p` }),
      },
      newestEntry("local", row.id),
    );

  /** A title's card (03 sections 3.5, 7.4); nothing is fetched for it. */
  const titleItem = (facts: TitleFacts, entry: LibraryWatchRow | null = null): LibraryItem =>
    withProgress(
      {
        ref: { kind: "title", id: facts.id },
        kind: facts.kind,
        title: facts.title,
        genres: [...facts.genres],
        favorite: favorites.isFavorite("title", facts.id),
        ...(facts.year !== undefined && { year: facts.year }),
        ...(facts.rating !== undefined && { rating: facts.rating }),
        ...(facts.posterUrl !== undefined && { posterUrl: rewriteImageUrl(facts.posterUrl) }),
      },
      entry ?? newestEntry("title", facts.id),
    );

  /** A title whose facts are not held: the id's readable form and no invented facts (03 section 3.5). */
  const skeletonTitle = (titleId: string, entry: LibraryWatchRow | null = null): LibraryItem =>
    withProgress(
      {
        ref: { kind: "title", id: titleId },
        kind: titleId.startsWith("tv-") ? "tv" : "movie",
        title: titleId,
        genres: [],
        favorite: favorites.isFavorite("title", titleId),
      },
      entry ?? newestEntry("title", titleId),
    );

  return { localItem, titleItem, skeletonTitle, progressOf };
}

export type LibraryItems = ReturnType<typeof createLibraryItems>;
