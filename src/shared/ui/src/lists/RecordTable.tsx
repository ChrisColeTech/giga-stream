import { useMemo, useState, type CSSProperties } from "react";
import { useElementWidth } from "../hooks/useElementWidth";
import { useRecordTable } from "../hooks/useRecordTable";
import { cn } from "../lib/cn";
import { columnTemplate, fitColumns, type FitOptions } from "../lib/record-columns";
import { BOUNDED_ROWS, END_COLUMN_PX, HEADER_HEIGHT, ROW_HEIGHT, TABLE_MIN_HEIGHT } from "../lib/window-constants";
import type { RecordTableProps } from "./record-table-types";
import { RecordTableBody } from "./RecordTableBody";
import { RecordTableHead } from "./RecordTableHead";

/* THE INDEX LIST (`docs/45`): one table for every admin list, on TanStack Table through `useRecordTable`. The columns
 * ALWAYS FIT: the scroller's width decides which columns show (`fitColumns`, by priority) and the one grid template
 * (`--cols`) is shared by the header and every row, so nothing scrolls sideways at 900px or wider. The table is ONE scroll
 * box with a sticky header: `fill` takes the group's remaining height (never less than the header and 8 rows) without
 * ever growing the page; `bounded` is as tall as its rows up to 10, then scrolls inside itself. */
export function RecordTable<TData extends object>({
  ariaLabel, columns, rows, idOf, rowView, ticks = true, waiting = false, size = "fill", sort,
}: RecordTableProps<TData>) {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const width = useElementWidth(scroller);
  const fit = useMemo<FitOptions>(() => ({ tick: ticks, endPx: END_COLUMN_PX }), [ticks]);
  const visibility = useMemo(() => fitColumns(columns, width, fit), [columns, width, fit]);
  const table = useRecordTable({ columns, data: rows, getRowId: idOf, visibility, manualSorting: sort !== undefined });
  const fill = size === "fill";
  const vars = { "--cols": columnTemplate(columns, visibility, fit), ...(fill ? { minHeight: TABLE_MIN_HEIGHT } : {}) };

  return (
    <div className={cn("min-w-0", fill ? "relative flex-1" : "flex flex-col")} style={vars as CSSProperties}>
      <div
        ref={setScroller}
        data-table-scroller=""
        className={cn("overflow-x-auto overflow-y-auto [scrollbar-gutter:stable]", fill && "absolute inset-0")}
        style={fill ? undefined : { maxHeight: HEADER_HEIGHT + BOUNDED_ROWS * ROW_HEIGHT }}
      >
        <RecordTableHead table={table} ticks={ticks} sort={sort} />
        <RecordTableBody table={table} ariaLabel={ariaLabel} ticks={ticks} rowView={rowView} waiting={waiting} />
      </div>
    </div>
  );
}
