/* A record grid's server-side sort (`docs/41` section 6): one column at a time; the first press sorts ascending, the
   second descending. Pure. */

export type SortDir = "asc" | "desc";

export interface SortState {
  readonly key: string;
  readonly dir: SortDir;
}

/** The sort after a press on column `key`. */
export function nextSort(current: SortState, key: string): SortState {
  return current.key === key && current.dir === "asc" ? { key, dir: "desc" } : { key, dir: "asc" };
}

/** The header cell's `aria-sort`: the sorted column says its direction, every other sortable one `none`. */
export function ariaSort(state: SortState, key: string): "ascending" | "descending" | "none" {
  if (state.key !== key) return "none";
  return state.dir === "asc" ? "ascending" : "descending";
}
