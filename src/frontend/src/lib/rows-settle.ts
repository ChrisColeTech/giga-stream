import { ROWS_READ_ITEMS, ROWS_SHELF_CARDS } from "@/lib/library-limits";
import type { Shelf } from "@/lib/rows-shelves";
import type { ResolvedItem } from "@/lib/library-marks";

/* When the Rows view may show its shelves (`docs/33` section 3). Pure: no React, no store, no services. */

export interface RowsInput {
  /** Changes whenever the shelves must be regrouped: query, refresh serial, Continue setting, collections, removals. */
  readonly key: string;
  /** A first-page read is in flight. */
  readonly loading: boolean;
  /** The loaded page was read for this very query and refresh serial. */
  readonly pageFresh: boolean;
  /** Continue watching and the collections have answered. */
  readonly sideReady: boolean;
  /** The title regions are still on their way. */
  readonly regionsLoading: boolean;
  /** Items the loaded page holds. */
  readonly held: number;
  /** The page has no next cursor. */
  readonly exhausted: boolean;
}

export interface RowsSnapshot {
  readonly key: string;
  readonly shelves: readonly Shelf[];
}

/** The settled data set is complete: the bounded read is held, or there is nothing more to read. */
export function rowsReady(input: RowsInput): boolean {
  if (input.loading || !input.pageFresh || !input.sideReady || input.regionsLoading) return false;
  return input.held >= ROWS_READ_ITEMS || input.exhausted;
}

/** The finished shelves, or null while the skeleton shows. Built once per key from the settled data set; the same
 *  object comes back while the key holds, whatever else changes. */
export function nextRowsSnapshot(
  previous: RowsSnapshot | null,
  input: RowsInput,
  build: () => readonly Shelf[],
): RowsSnapshot | null {
  if (input.loading || !rowsReady(input)) return null;
  if (previous !== null && previous.key === input.key) return previous;
  return { key: input.key, shelves: build() };
}

/** Whether the Rows view should ask for one more page: it shows, the bounded set is not held, and a page exists. */
export function rowsWantsPage(input: RowsInput, active: boolean, paging: boolean): boolean {
  if (!active || paging || input.loading || !input.pageFresh) return false;
  return input.held < ROWS_READ_ITEMS && !input.exhausted;
}

/** The first items of the loaded page that Rows groups. Pages only append, so these never change for a query. */
export function settledItems<T>(items: readonly T[]): readonly T[] {
  return items.slice(0, ROWS_READ_ITEMS);
}

/** The cards a shelf mounts. */
export function shelfCards(items: readonly ResolvedItem[]): readonly ResolvedItem[] {
  return items.slice(0, ROWS_SHELF_CARDS);
}
