import type { ItemKind } from "../store/collection-repository.js";
import type { FavoritesRepository } from "../store/favorites-repository.js";
import type { LibraryFileRow, LibraryWatchRow } from "../store/library-repository.js";
import type { LibraryItem, TitleDetail } from "../types/library.js";
import type { BackendTitle, TitleKind } from "./admin-titles.js";
import type { GenreView } from "./title-session.js";

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

/**
 * The library's row builders (docs/03 section 3.5): the local and title facts every view's cards
 * are made of. A local row's poster is its still's image-cache address; a title row's poster and
 * every other image go through the cache; genre ids decode through the session's genre lists.
 */
export function createLibraryItems(deps: {
  favorites: FavoritesRepository;
  newestEntry: (kind: ItemKind, itemId: string) => LibraryWatchRow | null;
  genreView: (kind: TitleKind) => Promise<GenreView | undefined>;
  rewriteImageUrl: (source: string) => string;
}) {
  const { favorites, newestEntry, genreView, rewriteImageUrl } = deps;

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
        title: row.title,
        genres: [],
        favorite: favorites.isFavorite("local", row.id),
        ...(row.posterId !== undefined && { posterUrl: `/api/images/${row.posterId}` }),
        ...(row.height !== undefined && { quality: `${row.height}p` }),
      },
      newestEntry("local", row.id),
    );

  /** A backend title row (03 sections 3.5, 7.4); nothing is fetched for it. */
  const titleItem = async (row: BackendTitle): Promise<LibraryItem> => {
    const view = await genreView(row.kind);
    return withProgress(
      {
        ref: { kind: "title", id: row.id },
        kind: row.kind,
        title: row.title,
        genres: row.genres.map((genre) => view?.byId.get(genre) ?? genre),
        favorite: favorites.isFavorite("title", row.id),
        ...(row.year !== undefined && { year: row.year }),
        ...(row.posterUrl !== undefined && { posterUrl: rewriteImageUrl(row.posterUrl) }),
      },
      newestEntry("title", row.id),
    );
  };

  /** A title's card from the session's detail (03 section 3.5: kept in memory for the session). */
  const detailItem = (detail: TitleDetail, entry: LibraryWatchRow | null = null): LibraryItem =>
    withProgress(
      {
        ref: { kind: "title", id: detail.id },
        kind: detail.kind,
        title: detail.title,
        genres: detail.genres,
        favorite: favorites.isFavorite("title", detail.id),
        ...(detail.year !== undefined && { year: detail.year }),
        ...(detail.posterUrl !== undefined && { posterUrl: detail.posterUrl }),
      },
      entry ?? newestEntry("title", detail.id),
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

  return { localItem, titleItem, detailItem, skeletonTitle, progressOf };
}

export type LibraryItems = ReturnType<typeof createLibraryItems>;
