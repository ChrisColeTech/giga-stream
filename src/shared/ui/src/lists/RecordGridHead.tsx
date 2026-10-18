import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "../lib/cn";
import type { GridShape } from "./record-grid-layout";
import { ariaSort, type SortState } from "./record-grid-sort";

export interface GridHeading {
  readonly key: string;
  /** The column's name, as `CollectionRows` writes it: lowercase words (`number`, `now playing`). */
  readonly label: string;
  /** A number column is right-aligned over its mono figures. */
  readonly align?: "left" | "right";
  /** The column sorts on the server: with the grid's `sort`, its cell is a button (`docs/41` section 6). */
  readonly sortable?: boolean;
}

/** A grid's server-side sort: the current column and direction, and the column a press asked for (the owner applies
 *  `nextSort`, so the order is changed where the query is kept). */
export interface GridSort {
  readonly state: SortState;
  readonly onSort: (key: string) => void;
}

export interface RecordGridHeadProps {
  readonly shape: GridShape;
  readonly headings: readonly GridHeading[];
  readonly sort?: GridSort;
  /** Pinned to the top of the grid's own scroller (the windowed grid). */
  readonly sticky?: boolean;
}

function Cell({ heading, sort }: { readonly heading: GridHeading; readonly sort?: GridSort }) {
  const align = heading.align === "right" && "text-right";
  if (sort === undefined || heading.sortable !== true) {
    return <span className={cn("truncate", align)}>{heading.label}</span>;
  }
  const order = ariaSort(sort.state, heading.key);
  const Glyph = order === "ascending" ? ArrowUp : order === "descending" ? ArrowDown : null;
  return (
    <button
      type="button"
      aria-sort={order}
      title={`Sort by ${heading.label}`}
      className={cn(
        "flex min-w-0 cursor-pointer items-center gap-1 border-0 bg-transparent p-0 hover:text-text",
        heading.align === "right" && "justify-end",
        order !== "none" && "text-muted",
      )}
      onClick={() => sort.onSort(heading.key)}
    >
      <span className="truncate">{heading.label}</span>
      {Glyph !== null && <Glyph aria-hidden className="size-3 flex-none" />}
    </button>
  );
}

/** The header row of a record grid (`docs/28` section 4.3): sans 12px semibold, faint, on the panel over a hairline,
 *  one cell per heading in the rows' own column set; the tick cell and the end cell empty (select-all is the selection
 *  toolbar's `All`). A sortable column's cell is a button carrying `aria-sort` and a direction arrow. */
export function RecordGridHead({ shape, headings, sort, sticky = false }: RecordGridHeadProps) {
  return (
    <div
      className={cn(
        "grid items-center gap-3 border-b border-hair bg-panel px-3 py-1.5 font-sans text-xs font-semibold text-faint",
        sticky && "sticky top-0 z-10",
      )}
      style={{ gridTemplateColumns: shape.columns }}
    >
      {shape.selectable && <span aria-hidden />}
      {headings.map((heading) => (
        <Cell key={heading.key} heading={heading} sort={sort} />
      ))}
      <span aria-hidden />
    </div>
  );
}
