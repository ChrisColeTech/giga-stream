import { SORT_OPTIONS } from "@/lib/library-copy";
import type { LibraryQuery, Scope, SourceId, WatchedFilter } from "@/lib/library-query";
import type { LibraryPrefs } from "@/types/settings";

const SCOPES: readonly Scope[] = ["all", "movie", "tv", "local"];
const WATCHED: readonly WatchedFilter[] = ["all", "unwatched", "watching", "watched"];
const VIEWS = ["all", "history", "favorites"] as const;
const YEAR = /^\d{4}$/;
const COLLECTION = "collection:";
/** The `libraryFilter` setting's bound (the fileserver's, and the Library read's `q`). */
export const LIBRARY_FILTER_MAX = 200;

/** The saved source if it still names something: a view, or a collection that still exists; otherwise All. */
function restoredSource(saved: string, collectionIds: readonly string[]): SourceId {
  const view = VIEWS.find((name) => name === saved);
  if (view !== undefined) return view;
  const id = saved.startsWith(COLLECTION) ? saved.slice(COLLECTION.length) : "";
  return id !== "" && collectionIds.includes(id) ? `${COLLECTION}${id}` : "all";
}

/** The query the Library opens with: the saved Type, source, Filter text, genres, year, watched filter and sort. Each
 *  field that is no longer valid (an unknown scope, a year that is not four digits, a collection that was deleted, a
 *  filter longer than the setting allows) reads as its default. */
export function restoredQuery(prefs: LibraryPrefs, collectionIds: readonly string[]): Partial<LibraryQuery> {
  const sort = SORT_OPTIONS.find((option) => option.value === prefs.librarySort)?.value ?? "newest";
  return {
    scope: SCOPES.find((scope) => scope === prefs.libraryScope) ?? "all",
    source: restoredSource(prefs.librarySource, collectionIds),
    search: prefs.libraryFilter.length <= LIBRARY_FILTER_MAX ? prefs.libraryFilter : "",
    genres: prefs.libraryGenres.filter((genre) => genre.trim() !== ""),
    year: YEAR.test(prefs.libraryYear) ? prefs.libraryYear : "",
    watched: WATCHED.find((watched) => watched === prefs.libraryWatched) ?? "all",
    sort,
  };
}

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, at) => value === b[at]);

/** The saved preferences a query change touches, and only those that really differ from what is saved. "trending" is a
 *  view of the moment, so it is not kept; a Filter text past the setting's bound is not sent (the server would refuse
 *  the whole patch). */
export function savedChange(change: Partial<LibraryQuery>, prefs: LibraryPrefs): Partial<LibraryPrefs> {
  return {
    ...(change.scope !== undefined && change.scope !== prefs.libraryScope ? { libraryScope: change.scope } : {}),
    ...(change.source !== undefined && change.source !== prefs.librarySource ? { librarySource: change.source } : {}),
    ...(change.search !== undefined && change.search !== prefs.libraryFilter
      && change.search.length <= LIBRARY_FILTER_MAX ? { libraryFilter: change.search } : {}),
    ...(change.genres !== undefined && !sameList(change.genres, prefs.libraryGenres)
      ? { libraryGenres: [...change.genres] } : {}),
    ...(change.year !== undefined && change.year !== prefs.libraryYear ? { libraryYear: change.year } : {}),
    ...(change.watched !== undefined && change.watched !== prefs.libraryWatched
      ? { libraryWatched: change.watched } : {}),
    ...(change.sort !== undefined && change.sort !== "trending" && change.sort !== prefs.librarySort
      ? { librarySort: change.sort } : {}),
  };
}
