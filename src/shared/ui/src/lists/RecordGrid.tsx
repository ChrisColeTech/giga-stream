import type { ReactNode } from "react";
import { Checkbox } from "../controls/Checkbox";
import { cn } from "../lib/cn";
import { GridShapeContext, gridShape, type GridLayout } from "./record-grid-layout";

export interface GridHeading {
  readonly key: string;
  /** The column's name, as `CollectionRows` writes it: lowercase words (`number`, `now playing`). */
  readonly label: string;
  /** A number column is right-aligned over its mono figures. */
  readonly align?: "left" | "right";
}

/** The header's select-all tick: `checked` is `"mixed"` over a partly ticked list. */
export interface GridSelection {
  readonly label: string;
  readonly checked: boolean | "mixed";
  readonly onToggle: (checked: boolean) => void;
}

export interface RecordGridProps {
  /** The list's accessible name, `Channels`. */
  readonly ariaLabel: string;
  readonly layout: GridLayout;
  readonly headings: readonly GridHeading[];
  /** Present, the list has a tick column and the header carries `Select all`. */
  readonly selection?: GridSelection;
  /** The rows (`RecordGridRow`) or `SkeletonGrid`, in the header's own column set. */
  readonly children: ReactNode;
}

/* THE INDEX LIST, in the template's `CollectionRows` vocabulary (`docs/28` section 4.3, Appendix A rows 32 to 36): a header
 * row (sans 12px semibold, faint, on the panel over a hairline), then 36px rows. Added for the admin: a selection column,
 * a selected fill, a state word, a dimmed disabled row, and the list's OWN horizontal scroller with a minimum width, so a
 * narrow window scrolls the list and never the page. */
export function RecordGrid({ ariaLabel, layout, headings, selection, children }: RecordGridProps) {
  const shape = gridShape(layout, selection !== undefined);
  return (
    <GridShapeContext value={shape}>
      <div className="overflow-x-auto">
        <div style={{ minWidth: layout.minWidth }}>
          <div
            className="grid items-center gap-3 border-b border-hair bg-panel px-3 py-1.5 font-sans text-xs font-semibold text-faint"
            style={{ gridTemplateColumns: shape.columns }}
          >
            {selection !== undefined && (
              <Checkbox checked={selection.checked} onChange={selection.onToggle} aria-label={selection.label} />
            )}
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
