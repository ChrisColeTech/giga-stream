import { nextSort, type SortDir, type SortState } from "@giga/ui/lists/record-grid-sort";

/* The query of an index list the admin holds whole (Providers, Playlists, Jobs, Accounts, Deleted titles), pure: the
 * text in the search field, the search that runs, the sort and the filter values, and the rows that pass them. Channels
 * and Titles are paged and ask the server; these lists are filtered here. No React, no store. */

/** A filter at its default: it lets every row through. */
export const ANY = "any";

export interface ListQuery {
  /** What the search field holds. */
  readonly typed: string;
  /** The search that runs: `typed` once the pause after typing (or Enter) committed it. */
  readonly q: string;
  /** The sorted column (a column id) and the direction; a key with no comparator leaves the rows in the list's order. */
  readonly sort: SortState;
  /** The filter values by filter id; an absent or `ANY` one passes every row. */
  readonly filters: Readonly<Record<string, string>>;
}

export const startQuery = (sort: SortState): ListQuery => ({ typed: "", q: "", sort, filters: {} });

/** What a list says about its rows: the text a search looks in, the value each filter compares, and a comparator for each
 *  sortable column (ascending). */
export interface ListSpec<T> {
  readonly fields: (row: T) => readonly string[];
  readonly filters: Readonly<Record<string, (row: T) => string>>;
  readonly sorts: Readonly<Record<string, (a: T, b: T) => number>>;
}

export const withTyped = (query: ListQuery, typed: string): ListQuery => ({ ...query, typed });

/** The pause after typing, Enter or the clear: the typed text becomes the search. */
export const withSearch = (query: ListQuery): ListQuery => ({ ...query, q: query.typed.trim() });

export const withFilter = (query: ListQuery, id: string, value: string): ListQuery => ({
  ...query,
  filters: { ...query.filters, [id]: value },
});

export const withSortKey = (query: ListQuery, key: string): ListQuery => ({ ...query, sort: { ...query.sort, key } });

export const withDirection = (query: ListQuery, dir: SortDir): ListQuery => ({ ...query, sort: { ...query.sort, dir } });

/** A press on a column heading: the first press ascending, the next descending. */
export const pressHeading = (query: ListQuery, key: string): ListQuery => ({
  ...query,
  sort: nextSort(query.sort, key),
});

const words = (text: string): string[] =>
  text
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter((word) => word !== "");

/** The rows that pass the search (every word of it is somewhere in the row's text) and every filter, in the sort's order. */
export function visibleRows<T>(rows: readonly T[], query: ListQuery, spec: ListSpec<T>): T[] {
  const wanted = words(query.q);
  const active = Object.entries(query.filters).filter(([id, value]) => value !== ANY && spec.filters[id] !== undefined);
  const passing = rows.filter((row) => {
    const text = spec.fields(row).join(" ").toLocaleLowerCase();
    if (!wanted.every((word) => text.includes(word))) return false;
    return active.every(([id, value]) => spec.filters[id]?.(row) === value);
  });
  const compare = spec.sorts[query.sort.key];
  if (compare === undefined) return passing;
  const sign = query.sort.dir === "asc" ? 1 : -1;
  return passing.sort((a, b) => sign * compare(a, b));
}

/** The header `All` over the rows shown: ticked, `mixed` over a part of them, or unticked (also for no rows). */
export function tickState(ids: readonly string[], ticked: readonly string[]): boolean | "mixed" {
  const held = new Set(ticked);
  const count = ids.filter((id) => held.has(id)).length;
  if (count === 0) return false;
  return count === ids.length ? true : "mixed";
}

/** Text order, case-insensitive, digits by value: the order a name column sorts in. */
export const byText = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
