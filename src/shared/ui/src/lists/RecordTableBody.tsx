import { RecordTableRow } from "./RecordTableRow";
import { RecordTableSkeletonRow } from "./RecordTableSkeletonRow";
import type { RecordRowView, RecordTableInstance } from "./record-table-types";

export interface RecordTableBodyProps<TData extends object> {
  readonly table: RecordTableInstance<TData>;
  readonly ariaLabel: string;
  readonly ticks: boolean;
  readonly rowView: (row: TData, index: number) => RecordRowView;
  /** Nothing read yet: skeleton rows in place of the rows (also when there are none to show). */
  readonly waiting: boolean;
  readonly skeletonRows?: number;
}

/** The rows of a `RecordTable`, every one mapped (an in-memory list). Skeleton rows in the same columns stand in while
 *  the list waits or is empty, never a sentence. A long paged list's virtual body is a sibling (`docs/45` wave W4). */
export function RecordTableBody<TData extends object>({
  table, ariaLabel, ticks, rowView, waiting, skeletonRows = 6,
}: RecordTableBodyProps<TData>) {
  const rows = table.getRowModel().rows;
  const showSkeleton = waiting || rows.length === 0;
  return (
    <ul className="m-0 flex list-none flex-col p-0" aria-label={ariaLabel} aria-busy={showSkeleton ? true : undefined}>
      {showSkeleton
        ? Array.from({ length: skeletonRows }, (_, index) => (
            <RecordTableSkeletonRow key={index} cells={table.getVisibleLeafColumns().length} ticks={ticks} seed={index} />
          ))
        : rows.map((row) => <RecordTableRow key={row.id} row={row} view={rowView(row.original, row.index)} ticks={ticks} />)}
    </ul>
  );
}
