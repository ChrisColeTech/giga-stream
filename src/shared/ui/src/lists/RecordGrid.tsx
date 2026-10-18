import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { GridShapeContext, gridShape, type GridLayout } from "./record-grid-layout";

export interface GridHeading {
  readonly key: string;
  /** The column's name, as `CollectionRows` writes it: lowercase words (`number`, `now playing`). */
  readonly label: string;
  /** A number column is right-aligned over its mono figures. */
  readonly align?: "left" | "right";
}

export interface RecordGridProps {
  /** The list's accessible name, `Channels`. */
  readonly ariaLabel: string;
  readonly layout: GridLayout;
  readonly headings: readonly GridHeading[];
  /** The list has a tick column. Its header cell stays empty: select-all is the selection toolbar's three-state `All`
   *  (`01` section 9; LoRA Trainer `DatasetRows.tsx` 51 draws the same empty cell). */
  readonly ticks?: boolean;
  /** The rows (`RecordGridRow`) or `SkeletonGrid`, in the header's own column set. */
  readonly children: ReactNode;
}

/* THE INDEX LIST, in the template's `CollectionRows` vocabulary (`docs/28` section 4.3, Appendix A rows 32 to 36): a header
 * row (sans 12px semibold, faint, on the panel over a hairline), then 36px rows. Added for the admin: a tick column,
 * a selected fill, a state word, a dimmed disabled row, and the list's OWN horizontal scroller with a minimum width, so a
 * narrow window scrolls the list and never the page. */
export function RecordGrid({ ariaLabel, layout, headings, ticks = false, children }: RecordGridProps) {
  const shape = gridShape(layout, ticks);
  return (
    <GridShapeContext value={shape}>
      <div className="overflow-x-auto">
        <div style={{ minWidth: layout.minWidth }}>
          <div
            className="grid items-center gap-3 border-b border-hair bg-panel px-3 py-1.5 font-sans text-xs font-semibold text-faint"
            style={{ gridTemplateColumns: shape.columns }}
          >
            {ticks && <span aria-hidden />}
            {headings.map((heading) => (
              <span key={heading.key} className={cn("truncate", heading.align === "right" && "text-right")}>
                {heading.label}
              </span>
            ))}
            <span aria-hidden />
          </div>
          <ul className="m-0 flex list-none flex-col p-0" aria-label={ariaLabel}>
            {children}
          </ul>
        </div>
      </div>
    </GridShapeContext>
  );
}
