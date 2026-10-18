import { useEffect, useRef } from "react";
import { pagerCanRequest, requestVisiblePageOnce } from "../lib/pager-rules";
import { pageSpan, pagesToRequest } from "../lib/range-pages";
import { sameRange } from "../lib/row-window";
import type { RowRange } from "../lib/window-types";

export interface RangePagerInput {
  readonly range: RowRange;
  /** Whole rows in view; 0 while hidden, and a hidden list never requests (`pagerCanRequest`). */
  readonly viewRows: number;
  readonly total: number;
  readonly pageSize: number;
  /** Undefined: that row's page is not loaded. Its identity changes when the loaded pages change. */
  readonly rowAt: (index: number) => unknown;
  readonly resetKey: string;
  /** Asks for rows `first` to `last` (one page); answers whether a read was really requested. */
  readonly onNeedRange?: (first: number, last: number) => boolean;
}

/** Asks for the pages the window shows (`docs/41` section 4.2): no sentinel, so a scrollbar drag to the middle fetches
 *  the middle. Evaluated on scroll (a range change), resize, count change and page arrival; no timer, no poll. A page
 *  already asked for is not asked again until the loaded pages change (a declined ask releases it at once); asks made
 *  without the person scrolling are bounded by `MAX_UNSCROLLED_PAGES`, so a failing read cannot loop. */
export function useRangePager({ range, viewRows, total, pageSize, rowAt, resetKey, onNeedRange }: RangePagerInput): void {
  const memory = useRef({ inFlight: new Set<number>(), unscrolled: 0, range, rowAt, resetKey });
  const { first, last } = range;
  useEffect(() => {
    const range = { first, last };
    const state = memory.current;
    if (state.resetKey !== resetKey || state.rowAt !== rowAt) state.inFlight = new Set();
    if (state.resetKey !== resetKey || !sameRange(state.range, range)) state.unscrolled = 0;
    state.range = range;
    state.rowAt = rowAt;
    state.resetKey = resetKey;
    if (onNeedRange === undefined || !pagerCanRequest({ top: 0, bottom: viewRows })) return;
    const pages = pagesToRequest({
      range, visibleRows: viewRows, total, pageSize, unscrolled: state.unscrolled, inFlight: state.inFlight,
      isLoaded: (page) => rowAt(page * pageSize) !== undefined,
    });
    for (const page of pages) {
      const span = pageSpan(page, pageSize, total);
      const guard = { current: false };
      if (requestVisiblePageOnce(guard, () => onNeedRange(span.first, span.last))) {
        state.inFlight.add(page);
        state.unscrolled += 1;
      }
    }
  }, [first, last, viewRows, total, pageSize, rowAt, resetKey, onNeedRange]);
}
