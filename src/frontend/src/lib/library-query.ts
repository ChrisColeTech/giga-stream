import { CONTINUE_LIMIT } from "@/lib/library-limits";
import type { ResolvedItem } from "@/lib/library-marks";
import type { CollectionRow } from "@/types/collection";
import type { LibraryItem, LibraryKind } from "@/types/library";

export type Scope = "all" | LibraryKind;
export type SourceId = "all" | "history" | "favorites" | `collection:${string}`;
export type SortKey = "newest" | "oldest" | "az" | "year";
export type WatchedFilter = "all" | "unwatched" | "watching" | "watched";
/** The presentation of the results: a grid of cards, a list of rows, or the Rows view of shelves (`06` section 4.3). */
export type ListView = "grid" | "list" | "rows";

/** Everything the Library narrows by. Scope and source come from the rail and the type strip; the rest from the filters. */
export interface LibraryQuery {
  readonly scope: Scope;
  readonly source: SourceId;
  readonly search: string;
  readonly genres: readonly string[];
  /** A year as text, or "" for any year (a select's value). */
  readonly year: string;
  readonly watched: WatchedFilter;
  readonly sort: SortKey;
}

export const DEFAULT_QUERY: LibraryQuery = {
  scope: "all",
  source: "all",
  search: "",
  genres: [],
  year: "",
  watched: "all",
  sort: "newest",
};

/** The Filter group's values at rest. Clear filters resets to these and keeps the search, the scope and the source. */
/** What Clear filters restores: everything the right pane sets (search, sort and the filters), never the type or source. */
export const FILTER_DEFAULTS = { search: "", sort: "newest", genres: [], year: "", watched: "all" } as const;

const COLLECTION_PREFIX = "collection:";

export function collectionSource(id: string): SourceId {
  return `${COLLECTION_PREFIX}${id}`;
}

/** The collection a source names, or null for the views. */
export function collectionOf(source: SourceId): string | null {
  return source.startsWith(COLLECTION_PREFIX) ? source.slice(COLLECTION_PREFIX.length) : null;
}

/** A value from a closed set, read from a control's text; anything else is the fallback. */
export function choiceOf<T extends string>(choices: readonly T[], value: string, fallback: T): T {
  return choices.find((choice) => choice === value) ?? fallback;
}

export function matchesSource(item: ResolvedItem, source: SourceId): boolean {
  if (source === "all") return true;
  if (source === "history") return item.progress !== undefined;
  if (source === "favorites") return item.favorite;
  const id = collectionOf(source);
  return id !== null && item.collectionIds.includes(id);
}

/** The watch state of an item, in the words of the Watched filter. */
export function watchStateOf(item: ResolvedItem): "unwatched" | "watching" | "watched" {
  if (item.progress === undefined) return "unwatched";
  return item.progress.state === "watched" ? "watched" : "watching";
}

export function matchesQuery(item: ResolvedItem, query: LibraryQuery): boolean {
  if (query.scope !== "all" && item.kind !== query.scope) return false;
  const text = query.search.trim().toLocaleLowerCase();
  if (text !== "" && !item.title.toLocaleLowerCase().includes(text)) return false;
  if (query.genres.length > 0 && !query.genres.some((genre) => item.genres.includes(genre))) return false;
  if (query.year !== "" && String(item.year) !== query.year) return false;
  return query.watched === "all" || watchStateOf(item) === query.watched;
}

/** Items in the order the sort names. Newest and Oldest follow the fixture list, which stands in for the date added. */
export function sortItems(items: readonly ResolvedItem[], sort: SortKey): ResolvedItem[] {
  const copy = [...items];
  switch (sort) {
    case "newest":
      return copy.reverse();
    case "oldest":
      return copy;
    case "az":
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case "year":
      return copy.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title));
  }
}

export function visibleItems(items: readonly ResolvedItem[], query: LibraryQuery): ResolvedItem[] {
  const narrowed = items.filter((item) => matchesSource(item, query.source) && matchesQuery(item, query));
  return sortItems(narrowed, query.sort);
}

/** Continue Watching: items being watched, in the scope the type strip names, at most the limit. */
export function continueItems(items: readonly ResolvedItem[], scope: Scope): ResolvedItem[] {
  return items
    .filter((item) => (scope === "all" || item.kind === scope) && item.progress?.state === "watching")
    .slice(0, CONTINUE_LIMIT);
}

export interface ViewCounts {
  readonly all: number;
  readonly history: number;
  readonly favorites: number;
  readonly collections: Readonly<Partial<Record<string, number>>>;
}

export function viewCounts(items: readonly ResolvedItem[], collections: readonly CollectionRow[]): ViewCounts {
  const perCollection: Record<string, number> = {};
  for (const row of collections) {
    perCollection[row.id] = items.filter((item) => item.collectionIds.includes(row.id)).length;
  }
  return {
    all: items.length,
    history: items.filter((item) => item.progress !== undefined).length,
    favorites: items.filter((item) => item.favorite).length,
    collections: perCollection,
  };
}

export function sortedCollections(rows: readonly CollectionRow[]): CollectionRow[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

/** Every genre in the library, alphabetical. */
export function genreChoices(items: readonly LibraryItem[]): string[] {
  return [...new Set(items.flatMap((item) => item.genres))].sort((a, b) => a.localeCompare(b));
}

/** Every release year in the library, newest first. */
export function yearChoices(items: readonly LibraryItem[]): number[] {
  const years = items.flatMap((item) => (item.year === undefined ? [] : [item.year]));
  return [...new Set(years)].sort((a, b) => b - a);
}
