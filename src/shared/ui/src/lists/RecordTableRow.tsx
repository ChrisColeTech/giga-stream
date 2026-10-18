import { flexRender, type Row } from "@tanstack/react-table";
import { Checkbox } from "../controls/Checkbox";
import { cn } from "../lib/cn";
import type { RecordColumnKind, RecordFeatures } from "../lib/record-columns";
import { CELL_MONO, CELL_NAME, CELL_NUMBER, CELL_TEXT } from "./record-grid-classes";
import type { RecordRowView } from "./record-table-types";

/** The cell wrapper's text style by the column's kind (`record-grid-classes`); a state or custom cell styles itself. */
const KIND_CLASS: Readonly<Record<RecordColumnKind, string>> = {
  name: CELL_NAME,
  text: CELL_TEXT,
  mono: CELL_MONO,
  number: CELL_NUMBER,
  state: "min-w-0 overflow-hidden",
  custom: "min-w-0 overflow-hidden",
};

const TITLED: ReadonlySet<RecordColumnKind> = new Set(["name", "text", "mono"]);

export interface RecordTableRowProps<TData extends object> {
  readonly row: Row<RecordFeatures, TData>;
  readonly view: RecordRowView;
  readonly ticks: boolean;
  /** The row's place in a paged list (0-based): the row then carries `data-index` and `aria-rowindex`, which keyboard
   *  movement by index finds. */
  readonly index?: number;
}

/** One row of a `RecordTable`: 36px on the table's `--cols`, a hover fill, the tick, then ONE spanning button (Enter and
 *  Space open the record) over a subgrid of the visible columns' cells (`flexRender`), then the end action in a cell that
 *  may overflow: an armed `Delete` grows leftwards over its neighbours. */
export function RecordTableRow<TData extends object>({ row, view, ticks, index }: RecordTableRowProps<TData>) {
  const cells = row.getVisibleCells();
  const ticked = view.ticked === true;
  return (
    <li
      data-index={index}
      aria-rowindex={index === undefined ? undefined : index + 1}
      data-st={view.state}
      data-ticked={ticked ? "" : undefined}
      className={cn("grid h-9 items-center gap-3 rounded-ctl px-3 text-sm hover:bg-hov", ticked && "bg-ctl", view.dimmed === true && "opacity-45")}
      style={{ gridTemplateColumns: "var(--cols)" }}
    >
      {ticks && view.tick !== undefined && <Checkbox checked={ticked} onChange={view.tick.onToggle} aria-label={view.tick.label} />}
      <button
        type="button"
        data-primary=""
        className="grid cursor-pointer grid-cols-subgrid items-center border-0 bg-transparent p-0 text-left"
        style={{ gridColumn: `${ticks ? 2 : 1} / span ${cells.length}` }}
        onClick={view.onOpen}
      >
        {cells.map((cell) => {
          const kind = cell.column.columnDef.meta?.kind ?? "text";
          const value = cell.getValue();
          return (
            <span
              key={cell.id}
              data-col={cell.column.id}
              title={TITLED.has(kind) && typeof value === "string" ? value : undefined}
              className={KIND_CLASS[kind]}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </span>
          );
        })}
      </button>
      <span className="relative z-10 flex justify-end [&>*]:shrink-0 [&>*]:whitespace-nowrap">{view.end}</span>
    </li>
  );
}
