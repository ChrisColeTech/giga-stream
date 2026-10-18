import type { FocusEvent, KeyboardEvent, ReactNode } from "react";
import type { RowWindow } from "../hooks/useRowWindow";
import { listStep } from "../lib/row-window";
import { ROW_HEIGHT } from "../lib/window-constants";
import { RecordTableRow } from "./RecordTableRow";
import { RecordTableSkeletonRow } from "./RecordTableSkeletonRow";
import type { RecordPaging, RecordRowView, RecordTableInstance } from "./record-table-types";

export interface RecordTableVirtualBodyProps<TData extends object> {
  readonly table: RecordTableInstance<TData>;
  readonly ariaLabel: string;
  readonly ticks: boolean;
  readonly paging: RecordPaging<TData>;
  readonly idOf: (row: TData) => string;
  readonly rowView: (row: TData, index: number) => RecordRowView;
  readonly window: RowWindow;
}

function rowIndexOf(target: EventTarget | null): number | null {
  const row = target instanceof Element ? target.closest("[data-index]") : null;
  const index = Number(row?.getAttribute("data-index"));
  return row === null || Number.isNaN(index) ? null : index;
}

/** The body of a paged `RecordTable` (`docs/45` sections 2.1 and 3): the rows of the window, blank gaps for the rows not
 *  mounted so the list is always `total * 36px`, and a skeleton row in the table's own columns for each mounted row whose
 *  page is not loaded. TanStack sees only the mounted loaded rows (`table`); the skeleton rows are drawn here by index.
 *  Arrow keys, Home, End, PageUp and PageDown move focus by index, so they reach rows not mounted yet. */
export function RecordTableVirtualBody<TData extends object>({
  table, ariaLabel, ticks, paging, idOf, rowView, window: win,
}: RecordTableVirtualBodyProps<TData>) {
  const byId = new Map(table.getRowModel().rows.map((row) => [row.id, row]));
  const cells = table.getVisibleLeafColumns().length;
  const { total, rowAt } = paging;

  const body: ReactNode[] = [];
  let next = 0;
  win.indexes.forEach((index, position) => {
    if (index > next) body.push(<li key={`gap-${position}`} aria-hidden className="flex-none" style={{ height: (index - next) * ROW_HEIGHT }} />);
    next = index + 1;
    const data = rowAt(index);
    const row = data === undefined ? undefined : byId.get(idOf(data));
    body.push(
      data === undefined || row === undefined ? (
        <RecordTableSkeletonRow key={`skeleton-${index}`} cells={cells} ticks={ticks} seed={index} />
      ) : (
        <RecordTableRow key={row.id} row={row} view={rowView(data, index)} ticks={ticks} index={index} />
      ),
    );
  });
  if (total > next) body.push(<li key="gap-end" aria-hidden className="flex-none" style={{ height: (total - next) * ROW_HEIGHT }} />);

  const onFocus = (event: FocusEvent<HTMLElement>): void => {
    const index = rowIndexOf(event.target);
    if (index !== null) win.pin(index);
  };
  const onBlur = (event: FocusEvent<HTMLElement>): void => {
    const to = event.relatedTarget;
    if (!(to instanceof Node && event.currentTarget.contains(to))) win.pin(null);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (!(event.target instanceof HTMLElement) || !event.target.hasAttribute("data-primary")) return;
    const index = rowIndexOf(event.target);
    const to = index === null ? null : listStep(event.key, index, win.viewRows, total);
    if (to === null) return;
    event.preventDefault();
    win.focusIndex(to);
  };

  return (
    <ul
      className="m-0 flex list-none flex-col p-0"
      aria-label={ariaLabel}
      aria-rowcount={total}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      {body}
    </ul>
  );
}
