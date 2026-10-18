import type { ShelfSpec } from "@/lib/rows-shelves";
import type { LibraryItem } from "@/types/library";

/* What one Rows shelf has read, and when the Rows view may reveal (`docs/33` section 2.3). Pure. */

export interface ShelfLoad {
  /** The shelf's loaded rows, in the server's order; pages only append. */
  readonly items: readonly LibraryItem[];
  /** The server's whole count, when it knows it. */
  readonly total?: number;
  /** The server's next page; absent at the true end (or after a failed next page). */
  readonly nextCursor?: string;
  /** The first page has answered (with rows, empty, or failed). */
  readonly answered: boolean;
  /** A next page is being read. */
  readonly paging: boolean;
}

export const UNANSWERED: ShelfLoad = { items: [], answered: false, paging: false };

export type ShelfLoads = ReadonlyMap<string, ShelfLoad>;

/** The ids of the shelves to show, in plan order, once every first page has answered; null until then. A shelf whose
 *  first page came back empty (or failed) is not shown. */
export function revealedShelves(specs: readonly ShelfSpec[], loads: ShelfLoads): string[] | null {
  const shown: string[] = [];
  for (const spec of specs) {
    const load = loads.get(spec.id);
    if (load === undefined || !load.answered) return null;
    if (load.items.length > 0) shown.push(spec.id);
  }
  return shown;
}

/** The count a shelf's heading shows: the server's total when known, else the rows loaded so far. */
export function shelfCount(load: ShelfLoad): number {
  return load.total ?? load.items.length;
}
