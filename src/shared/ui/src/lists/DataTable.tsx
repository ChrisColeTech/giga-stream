import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface Column<T> {
  readonly key: string;
  readonly label: string;
  readonly align?: "left" | "right";
  readonly width?: string;
  readonly cell: (row: T) => ReactNode;
}

/* A header is a section header (11px semibold, faint, sans), never mono. A cell is body text; a right-aligned value is
 * mono 11px in muted, so the numbers compare down the column. Each cell names its own text style: a plain join would
 * leave two colour utilities on one element and let stylesheet order decide. */
const TH = "border-b border-hair bg-panel px-3 py-1.5 font-sans text-xs font-semibold text-faint";
const TD = "truncate border-t border-hair px-3 py-1.5";
const TEXT = "text-sm text-text";
const VALUE = "text-right font-mono text-xs tabular-nums text-muted";

/** A table, never a dialog that grows with its content. A header and a row per record; measured numbers are mono and
 *  right-aligned so they compare down the column. An empty table renders its header and nothing else: the empty state is
 *  the empty table, with no text row standing in for it. */
export function DataTable<T>({
  label,
  columns,
  rows,
  rowKey,
}: {
  label: string;
  columns: ReadonlyArray<Column<T>>;
  rows: readonly T[];
  rowKey: (row: T) => string;
}) {
  return (
    <table aria-label={label} className="w-full table-fixed border-collapse overflow-hidden rounded-card border border-border">
      <colgroup>
        {columns.map((column) => (
          <col key={column.key} style={column.width === undefined ? undefined : { width: column.width }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} scope="col" className={cn(TH, column.align === "right" ? "text-right" : "text-left")}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} className="hover:[&>td]:bg-hov">
            {columns.map((column) => (
              <td key={column.key} className={cn(TD, column.align === "right" ? VALUE : TEXT)}>
                {column.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
