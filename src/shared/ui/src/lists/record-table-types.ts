import type { ReactNode } from "react";
import type { RecordColumns } from "../lib/record-columns";
import type { SortState } from "./record-grid-sort";

export type { RecordTableInstance } from "../hooks/useRecordTable";

/** A list's server-side sort: the current column and direction, and the column a press asked for (the owner applies
 *  `nextSort`, so the order is changed where the query is kept). Same shape as the old grid's `GridSort`. */
export interface RecordSort {
  readonly state: SortState;
  readonly onSort: (key: string) => void;
}

/** What a row says about itself beyond its cells: the table draws the 36px line, the tick, the open button and the end. */
export interface RecordRowView {
  /** The row's state word, also its `data-st` (`live`, `preparing`, `disabled`...). The word itself is a cell. */
  readonly state?: string;
  /** A disabled record stays in its list, dimmed to 45%. */
  readonly dimmed?: boolean;
  /** Ticked: the selected fill. */
  readonly ticked?: boolean;
  /** The row's tick, `Select Fixture News`; the table draws one when (and only when) it has a tick column. */
  readonly tick?: { readonly label: string; readonly onToggle: (ticked: boolean) => void };
  /** A press on the data cells opens the record. The tick and the end action sit outside this button. */
  readonly onOpen: () => void;
  /** The end of the row: the `Delete` `ArmedButton`. */
  readonly end: ReactNode;
}

/** `fill`: the table takes the group's remaining height (at least 8 rows) and scrolls inside it. `bounded`: as tall as its
 *  rows up to 10, then it scrolls inside itself (`Deleted titles`). */
export type RecordTableSize = "fill" | "bounded";

/** A long list read a page at a time (`docs/41` section 4.2): the table mounts only the rows near the viewport (above
 *  `WINDOW_MIN_ROWS`), draws a skeleton row for each whose page is not loaded and asks for the pages the window shows. */
export interface RecordPaging<TData> {
  /** Rows matching the query (known from the first page). */
  readonly total: number;
  /** The row at a position; undefined while its page is not loaded. Keep its identity stable while the loaded pages are
   *  unchanged: a new identity means "pages changed". */
  readonly rowAt: (index: number) => TData | undefined;
  /** The query, serialised: a change scrolls the list to the top. */
  readonly resetKey: string;
  /** Asks for rows `first` to `last` (one page); answers whether a read was requested. Never called while hidden. */
  readonly onNeedRange?: (first: number, last: number) => boolean;
  /** Rows per page `onNeedRange` asks for; `PAGE_SIZE` (100) by default. */
  readonly pageSize?: number;
}

export interface RecordTableProps<TData extends object> {
  /** The list's accessible name, `Providers`. */
  readonly ariaLabel: string;
  /** `column.columns([...])` of the tab's `<Tab>Columns.tsx`. A stable array. */
  readonly columns: RecordColumns<TData>;
  /** The rows, all of them (an in-memory list). Hold the array stable while the rows are unchanged. Absent when `paging`. */
  readonly rows?: TData[];
  /** A paged list in place of `rows`. */
  readonly paging?: RecordPaging<TData>;
  readonly idOf: (row: TData) => string;
  /** The row's tick, dimming, state, open and end; `index` is its place in a paged list. */
  readonly rowView: (row: TData, index: number) => RecordRowView;
  /** The end column's width in px; `END_COLUMN_PX` by default, `END_ACTIONS_PX` for a row with two actions. */
  readonly endPx?: number;
  /** The list has a tick column, whose header cell holds the three-state `All` of a `SelectAllScope`. Default true. */
  readonly ticks?: boolean;
  /** Nothing is read yet (or the surface is not ready): skeleton rows stand in the rows' place. */
  readonly waiting?: boolean;
  readonly size?: RecordTableSize;
  /** Server-side sort; absent, the headings sort the rows here. */
  readonly sort?: RecordSort;
}
