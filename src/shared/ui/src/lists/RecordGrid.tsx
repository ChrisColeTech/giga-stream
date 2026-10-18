import type { ReactNode } from "react";
import { GridShapeContext, gridShape, type GridLayout } from "./record-grid-layout";
import { RecordGridHead, type GridHeading, type GridSort } from "./RecordGridHead";

export type { GridHeading, GridSort } from "./RecordGridHead";

export interface RecordGridProps {
  /** The list's accessible name, `Channels`. */
  readonly ariaLabel: string;
  readonly layout: GridLayout;
  readonly headings: readonly GridHeading[];
  /** The list has a tick column. Its header cell holds the three-state `All` when a `SelectAllScope` stands above
   *  the grid, directly above the row ticks (`01` section 9). */
  readonly ticks?: boolean;
  /** Server-side sort: the sortable headings become buttons (`docs/41` section 6). */
  readonly sort?: GridSort;
  /** The rows (`RecordGridRow`) or `SkeletonGrid`, in the header's own column set. */
  readonly children: ReactNode;
}

/* THE INDEX LIST, in the template's `CollectionRows` vocabulary (`docs/28` section 4.3, Appendix A rows 32 to 36): a header
 * row (sans 12px semibold, faint, on the panel over a hairline), then 36px rows. Added for the admin: a tick column,
 * a selected fill, a state word, a dimmed disabled row, and the list's OWN horizontal scroller with a minimum width, so a
 * narrow window scrolls the list and never the page. A long list is `WindowedRecordGrid`, which draws this below its
 * threshold. */
export function RecordGrid({ ariaLabel, layout, headings, ticks = false, sort, children }: RecordGridProps) {
  const shape = gridShape(layout, ticks);
  return (
    <GridShapeContext value={shape}>
      <div className="overflow-x-auto">
        <div style={{ minWidth: layout.minWidth }}>
          <RecordGridHead shape={shape} headings={headings} sort={sort} />
          <ul className="m-0 flex list-none flex-col p-0" aria-label={ariaLabel}>
            {children}
          </ul>
        </div>
      </div>
    </GridShapeContext>
  );
}
