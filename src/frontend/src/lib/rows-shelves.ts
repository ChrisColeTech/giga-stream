import { LIBRARY_COPY } from "@/lib/library-copy";
import { itemKey, type Marks, type ResolvedItem } from "@/lib/library-marks";
import { collectionSource, continueItems, sortedCollections, type LibraryQuery } from "@/lib/library-query";
import type { CollectionRow } from "@/types/collection";
import type { LibraryKind } from "@/types/library";

/* The Rows view's shelves (`06` section 4, Rows). Pure: no React, no store, no services. */

/** A genre shelf needs at least this many items that no earlier genre shelf has taken. */
export const GENRE_MIN_ITEMS = 3;

/** At most this many genre shelves are drawn. */
export const GENRE_SHELVES_MAX = 6;

const FAVOURITES_NAME = "Favorites";

const TYPE_SHELVES: readonly { readonly scope: LibraryKind; readonly name: string }[] = [
  { scope: "movie", name: "Movies" },
  { scope: "tv", name: "TV" },
  { scope: "local", name: "Local files" },
];

/** What See all opens in the grid: the same query the rail, the type strip and the Genre filter set. */
export type ShelfGroup =
  | { readonly kind: "continue" }
  | { readonly kind: "favorites" }
  | { readonly kind: "collection"; readonly id: string }
  | { readonly kind: "type"; readonly scope: LibraryKind }
  | { readonly kind: "genre"; readonly genre: string };

export interface Shelf {
  /** Stable across renders: "continue", "favorites", "collection:<id>", "type:<kind>" or "genre:<name>". */
  readonly id: string;
  readonly name: string;
  readonly group: ShelfGroup;
  /** In the grid's Newest order, so a shelf and the grid it opens read the same. */
  readonly items: readonly ResolvedItem[];
}

export interface ShelfSource {
  /** Every item with the Library's marks applied (`resolveItems`). Membership is read from each `collectionIds`. */
  readonly items: readonly ResolvedItem[];
  readonly continuing?: readonly ResolvedItem[];
  readonly collections: readonly CollectionRow[];
  /** The store's marks. A favourite the store holds wins over the fixture's flag, as `resolveItem` reads it. */
  readonly marks: Marks;
  /** The Continue watching setting: off, the shelf is not drawn. Absent means on. */
  readonly showContinue?: boolean;
}

/** Whether an item is a favourite: the store's mark when it has one, else the item's own flag. */
export function isFavourite(item: ResolvedItem, marks: Marks): boolean {
  return marks.favourites[itemKey(item.ref)] ?? item.favorite;
}

/** The genre shelves: genres with at least GENRE_MIN_ITEMS items, most items first, and each item on at most one.
 *  Genres are offered in order of their item counts (ties by name). Each takes the items no earlier shelf has taken,
 *  and a genre that falls below the minimum after that is skipped. The shelves are then ordered by final counts. */
export function genreShelves(items: readonly ResolvedItem[]): Shelf[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const genre of new Set(item.genres)) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  const ranked = [...counts]
    .filter(([, count]) => count >= GENRE_MIN_ITEMS)
    .sort(([nameA, countA], [nameB, countB]) => countB - countA || nameA.localeCompare(nameB))
    .map(([genre]) => genre);
  const taken = new Set<string>();
  const shelves: Shelf[] = [];
  for (const genre of ranked) {
    if (shelves.length === GENRE_SHELVES_MAX) break;
    const members = items.filter((item) => item.genres.includes(genre) && !taken.has(itemKey(item.ref)));
    if (members.length < GENRE_MIN_ITEMS) continue;
    for (const item of members) taken.add(itemKey(item.ref));
    shelves.push({ id: `genre:${genre}`, name: genre, group: { kind: "genre", genre }, items: members });
  }
  return shelves.sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
}

function collectionShelf(row: CollectionRow, items: readonly ResolvedItem[]): Shelf {
  return {
    id: `collection:${row.id}`,
    name: row.name,
    group: { kind: "collection", id: row.id },
    items: items.filter((item) => item.collectionIds.includes(row.id)),
  };
}

/** The ordered shelves: Continue Watching, Favorites, each collection alphabetically, Movies, TV and Local files, then
 *  the genre shelves. Only a shelf with items is returned. */
export function buildShelves(source: ShelfSource): Shelf[] {
  const items = [...source.items];
  const candidates: Shelf[] = [
    {
      id: "continue",
      name: LIBRARY_COPY.continueHeading,
      group: { kind: "continue" },
      items: source.showContinue === false ? [] : source.continuing ?? continueItems(items, "all"),
    },
    {
      id: "favorites",
      name: FAVOURITES_NAME,
      group: { kind: "favorites" },
      items: items.filter((item) => isFavourite(item, source.marks)),
    },
    ...sortedCollections(source.collections).map((row) => collectionShelf(row, items)),
    ...TYPE_SHELVES.map(({ scope, name }): Shelf => ({
      id: `type:${scope}`,
      name,
      group: { kind: "type", scope },
      items: items.filter((item) => item.kind === scope),
    })),
    ...genreShelves(items),
  ];
  return candidates.filter((shelf) => shelf.items.length > 0);
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
