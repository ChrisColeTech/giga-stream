import { useState } from "react";
import { useTable, type ColumnVisibilityState, type ReactTable, type SortingState } from "@tanstack/react-table";
import { recordFeatures, type RecordColumns, type RecordFeatures } from "../lib/record-columns";

export interface RecordTableInput<TData extends object> {
  readonly columns: RecordColumns<TData>;
  /** The rows the table holds: all of an in-memory list, the loaded rows of a paged one. */
  readonly data: TData[];
  readonly getRowId: (row: TData) => string;
  /** Which columns show: `fitColumns`' answer for the scroller's width. */
  readonly visibility: ColumnVisibilityState;
  /** The order is the owner's (a server sort): TanStack does not sort. */
  readonly manualSorting?: boolean;
}

export type RecordTableInstance<TData extends object> = ReactTable<RecordFeatures, TData>;

/** THE ONLY CALL OF `useTable` in the family's lists (`docs/45` section 3): one table over the rows, with the sorting held
 *  here (a press cycles ascending, descending; there is no unsorted press) and the visibility held by the caller. */
export function useRecordTable<TData extends object>({
  columns, data, getRowId, visibility, manualSorting = false,
}: RecordTableInput<TData>): RecordTableInstance<TData> {
  const [sorting, setSorting] = useState<SortingState>([]);
  return useTable<RecordFeatures, TData>({
    features: recordFeatures,
    columns,
    data,
    getRowId,
    state: { sorting, columnVisibility: visibility },
    onSortingChange: setSorting,
    manualSorting,
    sortDescFirst: false,
    enableSortingRemoval: false,
  });
}
