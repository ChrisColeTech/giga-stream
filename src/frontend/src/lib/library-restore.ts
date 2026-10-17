import { SORT_OPTIONS } from "@/lib/library-copy";
import type { LibraryQuery, Scope, SourceId, WatchedFilter } from "@/lib/library-query";
import type { LibraryPrefs } from "@/types/settings";

const SCOPES: readonly Scope[] = ["all", "movie", "tv", "local"];
const WATCHED: readonly WatchedFilter[] = ["all", "unwatched", "watching", "watched"];
const VIEWS = ["all", "history", "favorites"] as const;
const YEAR = /^\d{4}$/;
const COLLECTION = "collection:";

/** The saved source if it still names something: a view, or a collection that still exists; otherwise All. */
function restoredSource(saved: string, collectionIds: readonly string[]): SourceId {
  const view = VIEWS.find((name) => name === saved);
  if (view !== undefined) return view;
  const id = saved.startsWith(COLLECTION) ? saved.slice(COLLECTION.length) : "";
  return id !== "" && collectionIds.includes(id) ? `${COLLECTION}${id}` : "all";
}

/** The query the Library opens with: the saved Type, source, genres, year, watched filter and sort. Each field that is no
 *  longer valid (an unknown scope, a year that is not four digits, a collection that was deleted) reads as its default.
 *  The search is never saved, so it is not part of this. */
export function restoredQuery(prefs: LibraryPrefs, collectionIds: readonly string[]): Partial<LibraryQuery> {
  const sort = SORT_OPTIONS.find((option) => option.value === prefs.librarySort)?.value ?? "newest";
  return {
    scope: SCOPES.find((scope) => scope === prefs.libraryScope) ?? "all",
    source: restoredSource(prefs.librarySource, collectionIds),
    genres: prefs.libraryGenres.filter((genre) => genre.trim() !== ""),
    year: YEAR.test(prefs.libraryYear) ? prefs.libraryYear : "",
    watched: WATCHED.find((watched) => watched === prefs.libraryWatched) ?? "all",
    sort,
  };
}

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, at) => value === b[at]);

/** The saved preferences a query change touches, and only those that really differ from what is saved. Search is
 *  transient and "trending" is a view of the moment, so neither is kept. */
export function savedChange(change: Partial<LibraryQuery>, prefs: LibraryPrefs): Partial<LibraryPrefs> {
  return {
    ...(change.scope !== undefined && change.scope !== prefs.libraryScope ? { libraryScope: change.scope } : {}),
    ...(change.source !== undefined && change.source !== prefs.librarySource ? { librarySource: change.source } : {}),
    ...(change.genres !== undefined && !sameList(change.genres, prefs.libraryGenres)
      ? { libraryGenres: [...change.genres] } : {}),
    ...(change.year !== undefined && change.year !== prefs.libraryYear ? { libraryYear: change.year } : {}),
    ...(change.watched !== undefined && change.watched !== prefs.libraryWatched
      ? { libraryWatched: change.watched } : {}),
    ...(change.sort !== undefined && change.sort !== "trending" && change.sort !== prefs.librarySort
      ? { librarySort: change.sort } : {}),
  };
}
