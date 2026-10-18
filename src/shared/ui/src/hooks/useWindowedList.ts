import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { LIST_LAYOUT, listRange, restoredTop, rowsInView, sameRange } from "../lib/list-window";
import { nonEmptyRange, scrollTopToReveal, windowSegments } from "../lib/window-rows";
import type { RowRange, WindowSegment } from "../lib/window-types";

export interface WindowedListInput {
  /** The grid's own scroller and its row list, each HELD IN STATE by a callback ref (`docs/32` "Fixed: grid after
   *  Rows"): a ref read once in an effect is still null when scroller and list mount in one commit. */
  readonly scroller: HTMLElement | null;
  readonly list: HTMLElement | null;
  readonly count: number;
  /** The query: a change scrolls to the top. A tab shown again keeps its offset. */
  readonly resetKey: string;
  /** The rows' viewport height to draw with before the first measurement (and in server rendering). */
  readonly seedViewport: number;
}

export interface WindowedList {
  /** The mounted rows: the viewport's and the overscan's. */
  readonly range: RowRange;
  /** Blank heights and mounted rows, top to bottom; a pinned row is among them. */
  readonly segments: readonly WindowSegment[];
  /** Whole rows the viewport shows; 0 while the list is hidden or not yet measured (nothing may be requested then). */
  readonly viewRows: number;
  /** Keeps a row mounted while focus is in it; null releases it. */
  readonly pin: (index: number | null) => void;
  /** Scrolls a row into view, mounts it and focuses its `[data-primary]` button (once its page is loaded). */
  readonly focusIndex: (index: number) => void;
}

/** Where the rows start inside the scroller's content: under the sticky header. */
const originOf = (root: HTMLElement, node: HTMLElement): number =>
  node.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;

/** The one-column windowing engine of a record list (`docs/41` section 4.1): it measures with a ResizeObserver and
 *  the scroller's scroll events (no timers), and answers which rows to mount. A zero size is a hidden surface: it
 *  changes nothing, and when shown again the last offset is restored. A `resetKey` change returns to the top. */
export function useWindowedList({ scroller, list, count, resetKey, seedViewport }: WindowedListInput): WindowedList {
  const [range, setRange] = useState<RowRange>(() => listRange(0, seedViewport, count));
  const [viewport, setViewport] = useState(0);
  const [pinned, setPinned] = useState<number | null>(null);
  const live = useRef({ count, hidden: false, lastTop: 0, focus: -1, resetKey });
  live.current.count = count;

  const measure = useCallback((): void => {
    if (scroller === null || list === null) return;
    const state = live.current;
    if (scroller.clientHeight === 0 || scroller.clientWidth === 0) {
      state.hidden = true;
      setViewport(0);
      return;
    }
    const top = restoredTop(state, scroller.scrollTop);
    if (top !== scroller.scrollTop) scroller.scrollTop = top;
    state.hidden = false;
    state.lastTop = scroller.scrollTop;
    /* The sticky header covers the top of the scroller, so the rows' viewport is the rest of it. */
    const height = Math.max(0, scroller.clientHeight - originOf(scroller, list));
    const next = listRange(scroller.scrollTop, height, state.count);
    setViewport(height);
    setRange((current) => (sameRange(current, next) ? current : next));
  }, [scroller, list]);

  useLayoutEffect(() => {
    if (scroller === null || list === null) return undefined;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => measure());
    observer?.observe(scroller);
    observer?.observe(list);
    scroller.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => {
      observer?.disconnect();
      scroller.removeEventListener("scroll", measure);
    };
  }, [scroller, list, measure]);
  useLayoutEffect(() => measure(), [count, measure]);

  /* A new query starts at the top; nothing focused or remembered of the old one is kept. */
  useLayoutEffect(() => {
    if (live.current.resetKey === resetKey) return;
    live.current.resetKey = resetKey;
    live.current.lastTop = 0;
    live.current.focus = -1;
    setPinned(null);
    if (scroller !== null) scroller.scrollTop = 0;
    measure();
  }, [resetKey, scroller, measure]);

  const tryFocus = useCallback((): void => {
    const index = live.current.focus;
    const button = index < 0 || list === null ? null
      : list.querySelector<HTMLElement>(`[data-index="${index}"] [data-primary]`);
    if (button === null) return;
    live.current.focus = -1;
    button.focus({ preventScroll: true });
  }, [list]);
  /* A pending focus lands in the commit that mounted its row, or the one in which its page arrived. */
  useLayoutEffect(() => tryFocus());

  const focusIndex = useCallback((index: number): void => {
    if (scroller === null || list === null || index < 0 || index >= live.current.count) return;
    live.current.focus = index;
    setPinned(index);
    const height = Math.max(0, scroller.clientHeight - originOf(scroller, list));
    const top = scrollTopToReveal(index, LIST_LAYOUT, { top: scroller.scrollTop, height }, 0);
    if (top !== scroller.scrollTop) scroller.scrollTop = top;
    measure();
    tryFocus();
  }, [scroller, list, measure, tryFocus]);

  /* A count that fell under the last measured range (before the re-measure lands) never mounts a row past the end. */
  const safe = nonEmptyRange({ first: range.first, last: Math.min(range.last, count - 1) }, count);
  const segments = windowSegments(safe, pinned, count, LIST_LAYOUT);
  return { range: safe, segments, viewRows: viewport > 0 ? rowsInView(viewport) : 0, pin: setPinned, focusIndex };
}
