import { Fragment } from "react";
import { isTicked } from "../lib/list-selection";
import { WINDOW_MIN_ROWS } from "../lib/window-constants";
import { RecordGrid } from "./RecordGrid";
import { RecordGridSkeletonRow } from "./RecordGridSkeletonRow";
import { SkeletonGrid } from "./SkeletonGrid";
import type { WindowedRecordGridProps } from "./windowed-grid-types";
import { WindowedRecordList } from "./WindowedRecordList";

export type { WindowedRecordGridProps } from "./windowed-grid-types";

/** THE LONG INDEX LIST (`docs/41` section 4.2). Above `WINDOW_MIN_ROWS` (100) rows it is `WindowedRecordList`: its own
 *  scroller, the header sticky in it, only the rows near the viewport mounted, skeleton rows where a page is not loaded,
 *  pages asked for by the visible range. At or under 100 rows it is the plain `RecordGrid` over every row, exactly as
 *  today (no scroller of its own, no paging): small lists, and the first moments of a big one. No rows at all is the
 *  skeleton, never a sentence. */
export function WindowedRecordGrid<Row>(props: WindowedRecordGridProps<Row>) {
  if (props.total > WINDOW_MIN_ROWS) return <WindowedRecordList {...props} />;
  const { ariaLabel, layout, headings, total, rowAt, idOf, renderRow, selection, sort } = props;
  return (
    <RecordGrid ariaLabel={ariaLabel} layout={layout} headings={headings} ticks={selection !== undefined} sort={sort}>
      {total <= 0 ? (
        <SkeletonGrid />
      ) : (
        Array.from({ length: total }, (_, index) => {
          const row = rowAt(index);
          if (row === undefined) return <RecordGridSkeletonRow key={`skeleton-${index}`} seed={index} />;
          const id = idOf(row);
          return <Fragment key={id}>{renderRow(row, index, selection !== undefined && isTicked(selection, id))}</Fragment>;
        })
      )}
    </RecordGrid>
  );
}
