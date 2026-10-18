import { useMemo, useState, type CSSProperties } from "react";
import { useElementWidth } from "../hooks/useElementWidth";
import { useRangePager } from "../hooks/useRangePager";
import { useRecordTable } from "../hooks/useRecordTable";
import { useRowWindow } from "../hooks/useRowWindow";
import { cn } from "../lib/cn";
import { columnTemplate, fitColumns, type FitOptions } from "../lib/record-columns";
import {
  BOUNDED_ROWS, END_COLUMN_PX, HEADER_HEIGHT, PAGE_SIZE, ROW_HEIGHT, TABLE_MIN_HEIGHT,
} from "../lib/window-constants";
import type { RecordTableProps } from "./record-table-types";
import { RecordTableBody } from "./RecordTableBody";
import { RecordTableHead } from "./RecordTableHead";
import { RecordTableVirtualBody } from "./RecordTableVirtualBody";

const NO_ROWS: never[] = [];
const noRowAt = (): undefined => undefined;

/* THE INDEX LIST (`docs/45`): one table for every admin list, on TanStack Table through `useRecordTable`. The columns
 * ALWAYS FIT: the scroller's width decides which columns show (`fitColumns`, by priority) and the one grid template
 * (`--cols`) is shared by the header and every row, so nothing scrolls sideways at 900px or wider. The table is ONE scroll
 * box with a sticky header: `fill` takes the group's remaining height (never less than the header and 8 rows) without
 * ever growing the page; `bounded` is as tall as its rows up to 10, then scrolls inside itself. A `paging` list is read
 * a page at a time and windowed (`useRowWindow`): TanStack holds only the mounted rows that are loaded. */
export function RecordTable<TData extends object>({
  ariaLabel, columns, rows = NO_ROWS, paging, idOf, rowView, endPx = END_COLUMN_PX, ticks = true, waiting = false,
  size = "fill", sort,
}: RecordTableProps<TData>) {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const width = useElementWidth(scroller);
  const fit = useMemo<FitOptions>(() => ({ tick: ticks, endPx }), [ticks, endPx]);
  const visibility = useMemo(() => fitColumns(columns, width, fit), [columns, width, fit]);

  const total = paging?.total ?? 0;
  const rowAt = paging?.rowAt ?? noRowAt;
  const resetKey = paging?.resetKey ?? "";
  const win = useRowWindow({ scroller, count: total, resetKey });
  useRangePager({
    range: win.range, viewRows: win.viewRows, total, pageSize: paging?.pageSize ?? PAGE_SIZE, rowAt, resetKey,
    onNeedRange: win.windowed ? paging?.onNeedRange : undefined,
  });
  const mounted = win.indexes.join(",");
  const data = useMemo(
    () => (paging === undefined ? rows : win.indexes.flatMap((index) => rowAt(index) ?? [])),
    // `mounted` stands for the indexes: the array is new on every render, its content rarely is.
    [paging === undefined, rows, mounted, rowAt],
  );

  const table = useRecordTable({ columns, data, getRowId: idOf, visibility, manualSorting: sort !== undefined });
  const fill = size === "fill";
  const vars = { "--cols": columnTemplate(columns, visibility, fit), ...(fill ? { minHeight: TABLE_MIN_HEIGHT } : {}) };
  const virtual = paging !== undefined && total > 0 && !waiting;

  return (
    <div className={cn("min-w-0", fill ? "relative flex-1" : "flex flex-col")} style={vars as CSSProperties}>
      <div
        ref={setScroller}
        data-table-scroller=""
        className={cn("overflow-x-auto overflow-y-auto [scrollbar-gutter:stable]", fill && "absolute inset-0")}
        style={fill ? undefined : { maxHeight: HEADER_HEIGHT + BOUNDED_ROWS * ROW_HEIGHT }}
      >
        <RecordTableHead table={table} ticks={ticks} sort={sort} />
        {virtual ? (
          <RecordTableVirtualBody
            table={table} ariaLabel={ariaLabel} ticks={ticks} paging={paging} idOf={idOf} rowView={rowView} window={win}
          />
        ) : (
          <RecordTableBody table={table} ariaLabel={ariaLabel} ticks={ticks} rowView={rowView} waiting={waiting || paging !== undefined} />
        )}
      </div>
    </div>
  );
}
