import { collectionOf, type LibraryQuery } from "@/lib/library-query";
import { isAllMedia } from "@/lib/library-media";
import { knownLibraryCount } from "@/services/library";
import { useAppStore } from "@/store/app-store";
import type { LibraryPage } from "@/types/library";

/** Records a page's whole-list count for its rail entry, when the page was read without any narrowing. */
export function acceptCount(query: LibraryQuery, page: LibraryPage): void {
  if (!isAllMedia(query.scope) || query.search.trim() !== "" || query.genres.length > 0
    || query.year !== "" || query.watched !== "all") return;
  const count = knownLibraryCount(page);
  if (count === undefined) return;
  const store = useAppStore.getState();
  const collectionId = collectionOf(query.source);
  store.setLibraryCounts(collectionId === null
    ? { ...store.libraryCounts, [query.source]: count }
    : { ...store.libraryCounts, collections: { ...store.libraryCounts.collections, [collectionId]: count } });
}

export function resultCount(
  result: PromiseSettledResult<LibraryPage>,
  previous: number | undefined,
): number | undefined {
  return result.status === "fulfilled" ? knownLibraryCount(result.value) : previous;
}
