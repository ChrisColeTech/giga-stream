import { flexRender, type Header } from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react";
import { CLEAR_ALL_TIP, SELECT_ALL_TIP } from "../controls/AllCheckbox";
import { Checkbox } from "../controls/Checkbox";
import { useSelectAll } from "../hooks/useSelectAll";
import { cn } from "../lib/cn";
import type { RecordFeatures } from "../lib/record-columns";
import { HEADER_HEIGHT } from "../lib/window-constants";
import { ariaSort } from "./record-grid-sort";
import type { RecordSort, RecordTableInstance } from "./record-table-types";

type Order = "ascending" | "descending" | "none";

export interface RecordTableHeadProps<TData extends object> {
  readonly table: RecordTableInstance<TData>;
  readonly ticks: boolean;
  readonly sort?: RecordSort;
}

function orderOf<TData extends object>(header: Header<RecordFeatures, TData, unknown>, sort?: RecordSort): Order {
  if (sort !== undefined) return ariaSort(sort.state, header.column.id);
  const direction = header.column.getIsSorted();
  return direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none";
}

function HeadCell<TData extends object>({ header, sort }: { readonly header: Header<RecordFeatures, TData, unknown>; readonly sort?: RecordSort }) {
  const right = header.column.columnDef.meta?.kind === "number";
  const label = flexRender(header.column.columnDef.header, header.getContext());
  if (!header.column.getCanSort()) return <span className={cn("truncate", right && "text-right")}>{label}</span>;
  const order = orderOf(header, sort);
  const Glyph = order === "ascending" ? ArrowUp : order === "descending" ? ArrowDown : null;
  const press = (): void => (sort === undefined ? header.column.toggleSorting() : sort.onSort(header.column.id));
  return (
    <button
      type="button"
      aria-sort={order}
      title={`Sort by ${typeof header.column.columnDef.header === "string" ? header.column.columnDef.header : header.column.id}`}
      className={cn(
        "flex min-w-0 cursor-pointer items-center gap-1 border-0 bg-transparent p-0 hover:text-text",
        right && "justify-end",
        order !== "none" && "text-muted",
      )}
      onClick={press}
    >
      <span className="truncate">{label}</span>
      {Glyph !== null && <Glyph aria-hidden className="size-3 flex-none" />}
    </button>
  );
}

/** The table's header: 29px, sticky at the top of the table's scroller, on the rows' own `--cols`. The tick cell holds the
 *  three-state `All` of a `SelectAllScope` above the row ticks; then one cell per visible column (a sortable one is a
 *  button with `aria-sort` and a direction arrow); the end cell is empty. */
export function RecordTableHead<TData extends object>({ table, ticks, sort }: RecordTableHeadProps<TData>) {
  const all = useSelectAll();
  const headers = table.getHeaderGroups()[0]?.headers ?? [];
  return (
    <div
      className="sticky top-0 z-20 grid items-center gap-3 bg-surface px-3 font-mono text-xs text-dim"
      style={{ gridTemplateColumns: "var(--cols)", height: HEADER_HEIGHT }}
    >
      {ticks &&
        (all === null ? (
          <span aria-hidden />
        ) : (
          <span title={all.checked === true ? CLEAR_ALL_TIP : SELECT_ALL_TIP} className="flex">
            <Checkbox checked={all.checked} onChange={all.onToggle} aria-label={all.label} disabled={all.disabled} />
          </span>
        ))}
      {headers.map((header) => (
        <HeadCell key={header.id} header={header} sort={sort} />
      ))}
      <span aria-hidden />
    </div>
  );
}
