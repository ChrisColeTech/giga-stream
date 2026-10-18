/* Selection that outlives the rows (`docs/41` section 4.4). Ticks are ids, never row objects, so they survive a row
   being unmounted by the window and its page being evicted or re-read. Pure. */

/** Either the ticked ids, or every row of one query but the ones unticked since. */
export type ListSelection =
  | { readonly mode: "ids"; readonly ids: ReadonlySet<string> }
  | { readonly mode: "all-matching"; readonly queryKey: string; readonly except: ReadonlySet<string> };

export const NO_SELECTION: ListSelection = { mode: "ids", ids: new Set() };

export function isTicked(selection: ListSelection, id: string): boolean {
  return selection.mode === "ids" ? selection.ids.has(id) : !selection.except.has(id);
}

const withId = (set: ReadonlySet<string>, id: string, on: boolean): ReadonlySet<string> => {
  if (set.has(id) === on) return set;
  const next = new Set(set);
  if (on) next.add(id);
  else next.delete(id);
  return next;
};

/** A row's tick: adds or removes its id (in `all-matching` mode it edits the exceptions instead). */
export function tickRow(selection: ListSelection, id: string, on: boolean): ListSelection {
  if (selection.mode === "ids") return { mode: "ids", ids: withId(selection.ids, id, on) };
  return { ...selection, except: withId(selection.except, id, !on) };
}

/** The selection toolbar's `All` (the header tick of `docs/41`): on ticks every LOADED row of the query, never every
 *  record; off clears everything. */
export function tickLoaded(loadedIds: readonly string[], on: boolean): ListSelection {
  return on ? { mode: "ids", ids: new Set(loadedIds) } : NO_SELECTION;
}

/** `Select all M matching`: the separate, visible step to every row of the query. */
export function selectAllMatching(queryKey: string): ListSelection {
  return { mode: "all-matching", queryKey, except: new Set() };
}

/** How many rows are ticked, given the query's total. */
export function selectedCount(selection: ListSelection, total: number): number {
  return selection.mode === "ids" ? selection.ids.size : Math.max(0, total - selection.except.size);
}

/** The `All` checkbox's state over the loaded rows: all of them ticked, none, or some. */
export function loadedState(selection: ListSelection, loadedIds: readonly string[]): boolean | "mixed" {
  if (loadedIds.length === 0) return false;
  const ticked = loadedIds.filter((id) => isTicked(selection, id)).length;
  return ticked === 0 ? false : ticked === loadedIds.length ? true : "mixed";
}

/** The `M` of `Select all M matching`, or null when the offer does not stand: it appears once every loaded row is
 *  ticked by id and the query holds more rows than are loaded. */
export function matchingOffer(selection: ListSelection, loadedIds: readonly string[], total: number): number | null {
  if (selection.mode !== "ids" || total <= loadedIds.length) return null;
  return loadedState(selection, loadedIds) === true ? total : null;
}

/** The selection after the query changed: one that described every row of another query no longer means anything
 *  and returns to `ids` mode, empty; ticked ids are kept. */
export function forQuery(selection: ListSelection, queryKey: string): ListSelection {
  return selection.mode === "all-matching" && selection.queryKey !== queryKey ? NO_SELECTION : selection;
}

/** Keeps only these ids ticked (after a bulk run: the failed and skipped rows), in `ids` mode. */
export function keepOnly(ids: readonly string[]): ListSelection {
  return { mode: "ids", ids: new Set(ids) };
}

/** A row removed by a delete leaves the selection. */
export function removeId(selection: ListSelection, id: string): ListSelection {
  if (selection.mode === "ids") return { mode: "ids", ids: withId(selection.ids, id, false) };
  return { ...selection, except: withId(selection.except, id, false) };
}

export type RangeTick =
  | { readonly kind: "ticked"; readonly selection: ListSelection }
  | { readonly kind: "missing"; readonly indexes: readonly number[] };

/** Shift-click: every row from `from` to `to` (either order) set to `on`. When some rows of the range are not loaded the
 *  selection is not changed and their indexes are answered, so the caller reads their pages and tries again. */
export function tickRange(
  selection: ListSelection,
  from: number,
  to: number,
  on: boolean,
  idAt: (index: number) => string | undefined,
): RangeTick {
  const ids: string[] = [];
  const missing: number[] = [];
  for (let index = Math.min(from, to); index <= Math.max(from, to); index += 1) {
    const id = idAt(index);
    if (id === undefined) missing.push(index);
    else ids.push(id);
  }
  if (missing.length > 0) return { kind: "missing", indexes: missing };
  return { kind: "ticked", selection: ids.reduce((next, id) => tickRow(next, id, on), selection) };
}
