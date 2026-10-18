import type { ReactNode } from "react";
import type { ListSelection } from "../lib/list-selection";
import type { GridLayout } from "./record-grid-layout";
import type { GridHeading, GridSort } from "./RecordGridHead";

/** A record grid over a list that may be long and paged (`docs/41` section 4.2). */
export interface WindowedRecordGridProps<Row> {
  /** The list's accessible name, `Channels`. */
  readonly ariaLabel: string;
  readonly layout: GridLayout;
  readonly headings: readonly GridHeading[];
  /** Rows matching the query (known from the first page). 0 draws the skeleton rows. */
  readonly total: number;
  /** The row at a position; undefined while its page is not loaded (a skeleton row stands in its place). Keep its
   *  identity stable while the loaded pages are unchanged: a new identity means "pages changed". */
  readonly rowAt: (index: number) => Row | undefined;
  readonly idOf: (row: Row) => string;
  /** One `RecordGridRow` (state word, dim, tick, open, Delete: all as in the plain grid). `ticked` is read from
   *  `selection` by id, so a tick survives the row being unmounted or its page re-read. */
  readonly renderRow: (row: Row, index: number, ticked: boolean) => ReactNode;
  /** The ticks, by id; present when (and only when) the grid has a tick column. */
  readonly selection?: ListSelection;
  /** Server-side sort; the sortable headings become buttons. */
  readonly sort?: GridSort;
  /** The query, serialised: a change scrolls the list to the top. */
  readonly resetKey: string;
  /** Asks for rows `first` to `last` (one page) that the window shows or is about to; answers whether a read was
   *  requested. Never called while the list is hidden. Absent for a list held whole in memory. */
  readonly onNeedRange?: (first: number, last: number) => boolean;
  /** Rows per page `onNeedRange` asks for; `PAGE_SIZE` (100) by default. */
  readonly pageSize?: number;
}
