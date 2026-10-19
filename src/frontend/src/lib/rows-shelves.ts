import { LIBRARY_COPY } from "@/lib/library-copy";
import { collectionSource, sortedCollections, type LibraryQuery } from "@/lib/library-query";
import type { CollectionRow } from "@/types/collection";
import type { LibraryKind } from "@/types/library";

/* The Rows view's shelves (`docs/33` section 2.1). Pure: no React, no store, no services. */

/** At most this many genre shelves are planned. */
export const GENRE_SHELVES_MAX = 6;

const FAVOURITES_NAME = "Favorites";

const TYPE_SHELVES: readonly { readonly scope: LibraryKind; readonly name: string }[] = [
  { scope: "movie", name: "Movies" },
  { scope: "tv", name: "TV" },
  { scope: "local", name: "Local files" },
];

/** What a shelf narrows by, and what See all opens in the grid. */
export type ShelfGroup =
  | { readonly kind: "continue" }
  | { readonly kind: "favorites" }
  | { readonly kind: "collection"; readonly id: string }
  | { readonly kind: "type"; readonly scope: LibraryKind }
  | { readonly kind: "genre"; readonly genre: string };

/** One planned shelf: its own query through the request layer. */
export interface ShelfSpec {
  /** Stable for the plan: "continue", "favorites", "collection:<id>", "type:<kind>" or "genre:<name>". */
  readonly id: string;
  readonly name: string;
  readonly group: ShelfGroup;
  readonly query: LibraryQuery;
}

export interface ShelfPlanInput {
  /** The Library's current query: the rail's view, Media, title search, facets and sort. */
  readonly query: LibraryQuery;
  /** The genre facets of the current query's first page, in the server's order. */
  readonly genreFacets: readonly string[];
  readonly collections: readonly CollectionRow[];
  /** The Continue watching setting, already off in History. */
  readonly showContinue: boolean;
}

/** The current query narrowed to one shelf's group, or null when the two cannot both hold (the shelf would be empty, or
 *  the server cannot intersect them). */
export function shelfQuery(base: LibraryQuery, group: ShelfGroup): LibraryQuery | null {
  switch (group.kind) {
    case "continue":
      if (base.source === "history" || base.watched === "watched" || base.watched === "unwatched") return null;
      return { ...base, watched: "watching" };
    case "favorites":
      return base.source === "all" ? { ...base, source: "favorites" } : null;
    case "collection":
      return base.source === "all" ? { ...base, source: collectionSource(group.id) } : null;
    case "type":
      return base.scope === "all" || base.scope === group.scope ? { ...base, scope: group.scope } : null;
    case "genre":
      return base.genres.length === 0 || base.genres.includes(group.genre) ? { ...base, genres: [group.genre] } : null;
  }
}

/** The genres that get a shelf: the Genre filter's values when it has any, else the facets, first six. Local files carry
 *  no genres, so a Local-only query has none. */
export function shelfGenres(query: LibraryQuery, facets: readonly string[]): string[] {
  if (query.scope === "local") return [];
  const source = query.genres.length > 0 ? query.genres : facets;
  return [...new Set(source)].slice(0, GENRE_SHELVES_MAX);
}

function spec(id: string, name: string, group: ShelfGroup, base: LibraryQuery): ShelfSpec[] {
  const query = shelfQuery(base, group);
  return query === null ? [] : [{ id, name, group, query }];
}

/** The planned shelves in their fixed order: Continue watching, Favorites, each collection alphabetically, Movies, TV
 *  and Local files, then the genres. Which of them have items is known only once their first pages answer. */
export function planShelves(input: ShelfPlanInput): ShelfSpec[] {
  const { query } = input;
  return [
    ...(input.showContinue ? spec("continue", LIBRARY_COPY.continueHeading, { kind: "continue" }, query) : []),
    ...spec("favorites", FAVOURITES_NAME, { kind: "favorites" }, query),
    ...sortedCollections(input.collections).flatMap((row) =>
      spec(`collection:${row.id}`, row.name, { kind: "collection", id: row.id }, query)),
    ...TYPE_SHELVES.flatMap(({ scope, name }) => spec(`type:${scope}`, name, { kind: "type", scope }, query)),
    ...shelfGenres(query, input.genreFacets).flatMap((genre) =>
      spec(`genre:${genre}`, genre, { kind: "genre", genre }, query)),
  ];
}

/* See all clears the query to a fresh one that shows exactly the shelf's group. The sort is the user's and stays. */
const FRESH: Partial<LibraryQuery> = { scope: "all", source: "all", search: "", genres: [], year: "", watched: "all" };

/** The query patch a shelf's See all applies through the Library's own setter. */
export function groupQuery(group: ShelfGroup): Partial<LibraryQuery> {
  switch (group.kind) {
    case "continue":
      return FRESH;
    case "favorites":
      return { ...FRESH, source: "favorites" };
    case "collection":
      return { ...FRESH, source: collectionSource(group.id) };
    case "type":
      return { ...FRESH, scope: group.scope };
    case "genre":
      return { ...FRESH, genres: [group.genre] };
  }
}
