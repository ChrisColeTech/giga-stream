import { useState, type FocusEvent, type KeyboardEvent } from "react";
import { useHostHeight } from "../hooks/useHostHeight";
import { useRangePager } from "../hooks/useRangePager";
import { useWindowedList } from "../hooks/useWindowedList";
import { isTicked } from "../lib/list-selection";
import { listHeight, listStep } from "../lib/list-window";
import { HEADER_HEIGHT, PAGE_SIZE } from "../lib/window-constants";
import { GridRowIndexContext, GridShapeContext, gridShape } from "./record-grid-layout";
import { RecordGridHead } from "./RecordGridHead";
import { RecordGridSkeletonRow } from "./RecordGridSkeletonRow";
import type { WindowedRecordGridProps } from "./windowed-grid-types";

function rowIndexOf(target: EventTarget | null): number | null {
  const row = target instanceof Element ? target.closest("[data-index]") : null;
  const index = Number(row?.getAttribute("data-index"));
  return row === null || Number.isNaN(index) ? null : index;
}

/** The windowed body of `WindowedRecordGrid` (`docs/41` section 4.2): ONE scroller for both axes (a sticky header does
 *  not stick through an `overflow-x` box that is not the vertical scroller), as tall as its rows up to the room the
 *  page offers. The header is sticky at its top; the rows are a block of `total * 36px`: blank gaps, the mounted rows
 *  (the viewport, two of overscan each side, and the focused row, kept while focus is in it), a skeleton row for each
 *  mounted row whose page is not loaded. Arrow keys, Home, End, PageUp and PageDown move focus by index, so they reach
 *  rows not mounted yet. The scroller and the list are held in state, never read once from a ref. */
export function WindowedRecordList<Row>({
  ariaLabel, layout, headings, total, rowAt, idOf, renderRow, selection, sort, resetKey, onNeedRange,
  pageSize = PAGE_SIZE,
}: WindowedRecordGridProps<Row>) {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [list, setList] = useState<HTMLUListElement | null>(null);
  const height = listHeight(total, useHostHeight(scroller));
  const win = useWindowedList({ scroller, list, count: total, resetKey, seedViewport: height - HEADER_HEIGHT });
  useRangePager({ range: win.range, viewRows: win.viewRows, total, pageSize, rowAt, resetKey, onNeedRange });
  const shape = gridShape(layout, selection !== undefined);

  const onFocus = (event: FocusEvent<HTMLElement>): void => {
    const index = rowIndexOf(event.target);
    if (index !== null) win.pin(index);
  };
  const onBlur = (event: FocusEvent<HTMLElement>): void => {
    const next = event.relatedTarget;
    if (!(next instanceof Node && event.currentTarget.contains(next))) win.pin(null);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (!(event.target instanceof HTMLElement) || !event.target.hasAttribute("data-primary")) return;
    const index = rowIndexOf(event.target);
    const next = index === null ? null : listStep(event.key, index, win.viewRows, total);
    if (next === null) return;
    event.preventDefault();
    win.focusIndex(next);
  };

  return (
    <GridShapeContext value={shape}>
      <div ref={setScroller} className="overflow-auto" style={{ height }}>
        <div style={{ minWidth: layout.minWidth }}>
          <RecordGridHead shape={shape} headings={headings} sort={sort} sticky />
          <ul
            ref={setList}
            className="m-0 flex list-none flex-col p-0"
            aria-label={ariaLabel}
            aria-rowcount={total}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
          >
            {win.segments.map((segment, position) => {
              if (segment.kind === "gap") {
                return <li key={`gap-${position}`} aria-hidden className="flex-none" style={{ height: segment.height }} />;
              }
              const row = rowAt(segment.index);
              if (row === undefined) {
                return <RecordGridSkeletonRow key={`skeleton-${segment.index}`} seed={segment.index} />;
              }
              const id = idOf(row);
              return (
                <GridRowIndexContext key={id} value={segment.index}>
                  {renderRow(row, segment.index, selection !== undefined && isTicked(selection, id))}
                </GridRowIndexContext>
              );
            })}
          </ul>
        </div>
      </div>
    </GridShapeContext>
  );
}
