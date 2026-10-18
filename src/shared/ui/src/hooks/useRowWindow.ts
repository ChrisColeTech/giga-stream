import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { defaultRangeExtractor, useVirtualizer, type Range } from "@tanstack/react-virtual";
import { LIST_LAYOUT, mountedRange, restoredTop, rowsInView, withPinned } from "../lib/row-window";
import { HEADER_HEIGHT, OVERSCAN_ROWS, ROW_HEIGHT, TABLE_MIN_HEIGHT, WINDOW_MIN_ROWS } from "../lib/window-constants";
import { scrollTopToReveal } from "../lib/window-rows";
import type { RowRange } from "../lib/window-types";

export interface RowWindowInput {
  /** The table's scroller, HELD IN STATE by a callback ref (`docs/32` "Fixed: grid after Rows"): a ref read once in an
   *  effect is still null when scroller and rows mount in one commit. */
  readonly scroller: HTMLElement | null;
  /** Rows in the list (the server's total). */
  readonly count: number;
  /** The query: a change scrolls to the top. A tab shown again keeps its offset. */
  readonly resetKey: string;
}

export interface RowWindow {
  /** More rows than `WINDOW_MIN_ROWS`: only the rows near the viewport are mounted. At or under it, every row is. */
  readonly windowed: boolean;
  /** The indexes to mount, ascending: the viewport's, the overscan's and the focused row's. */
  readonly indexes: readonly number[];
  /** The rows the window shows with its overscan (what the pager reads); empty while hidden. */
  readonly range: RowRange;
  /** Whole rows the viewport shows; 0 while the list is hidden, not measured or not windowed (nothing may be requested). */
  readonly viewRows: number;
  /** Keeps a row mounted while focus is in it; null releases it. */
  readonly pin: (index: number | null) => void;
  /** Scrolls a row into view, mounts it and focuses its `[data-primary]` button (once its page is loaded). */
  readonly focusIndex: (index: number) => void;
}

/** THE ROW WINDOW of a long paged table (`docs/45` section 2.1, `docs/41` section 4.1): `@tanstack/react-virtual` over
 *  `count` fixed 36px rows, the sticky header as its scroll margin. It answers which indexes to mount; the table draws
 *  them, a skeleton row for each whose page is not loaded. A zero size is a hidden surface: nothing is mounted or
 *  requested, and when shown again the last offset is put back. A `resetKey` change returns to the top. */
export function useRowWindow({ scroller, count, resetKey }: RowWindowInput): RowWindow {
  const windowed = count > WINDOW_MIN_ROWS;
  const [pinned, setPinned] = useState<number | null>(null);
  const live = useRef({ count, hidden: false, lastTop: 0, focus: -1, resetKey });
  live.current.count = count;

  const rangeExtractor = useCallback(
    (range: Range): number[] => withPinned(defaultRangeExtractor(range), pinned, count),
    [pinned, count],
  );
  const virtual = useVirtualizer<HTMLElement, Element>({
    count: windowed ? count : 0,
    getScrollElement: () => scroller,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN_ROWS,
    scrollMargin: HEADER_HEIGHT,
    initialRect: { width: 0, height: TABLE_MIN_HEIGHT },
    rangeExtractor,
    enabled: windowed,
  });

  /* A hidden surface (zero size) changes nothing; shown again, the offset it had is put back. */
  useLayoutEffect(() => {
    if (scroller === null) return undefined;
    const state = live.current;
    const note = (): void => {
      if (scroller.clientHeight === 0 || scroller.clientWidth === 0) {
        state.hidden = true;
        return;
      }
      const top = restoredTop(state, scroller.scrollTop);
      if (top !== scroller.scrollTop) scroller.scrollTop = top;
      state.hidden = false;
      state.lastTop = scroller.scrollTop;
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(note);
    observer?.observe(scroller);
    scroller.addEventListener("scroll", note, { passive: true });
    note();
    return () => {
      observer?.disconnect();
      scroller.removeEventListener("scroll", note);
    };
  }, [scroller]);

  /* A new query starts at the top; nothing focused or remembered of the old one is kept. */
  useLayoutEffect(() => {
    if (live.current.resetKey === resetKey) return;
    live.current.resetKey = resetKey;
    live.current.lastTop = 0;
    live.current.focus = -1;
    setPinned(null);
    if (scroller !== null) scroller.scrollTop = 0;
  }, [resetKey, scroller]);

  const tryFocus = useCallback((): void => {
    const index = live.current.focus;
    const button = index < 0 || scroller === null
      ? null
      : scroller.querySelector<HTMLElement>(`[data-index="${index}"] [data-primary]`);
    if (button === null) return;
    live.current.focus = -1;
    button.focus({ preventScroll: true });
  }, [scroller]);
  /* A pending focus lands in the commit that mounted its row, or the one in which its page arrived. */
  useLayoutEffect(() => tryFocus());

  const focusIndex = useCallback(
    (index: number): void => {
      if (scroller === null || index < 0 || index >= live.current.count) return;
      live.current.focus = index;
      setPinned(index);
      const view = { top: scroller.scrollTop, height: Math.max(0, scroller.clientHeight - HEADER_HEIGHT) };
      const top = scrollTopToReveal(index, LIST_LAYOUT, view, 0);
      if (top !== scroller.scrollTop) scroller.scrollTop = top;
      tryFocus();
    },
    [scroller, tryFocus],
  );

  const items = windowed ? virtual.getVirtualItems() : [];
  const all = useMemo(() => Array.from({ length: windowed ? 0 : count }, (_, index) => index), [windowed, count]);
  const indexes = windowed ? items.map((item) => item.index).filter((index) => index < count) : all;
  const height = scroller === null ? 0 : (virtual.scrollRect?.height ?? 0);
  return {
    windowed,
    indexes,
    range: windowed ? mountedRange(virtual.range, count, OVERSCAN_ROWS) : { first: 0, last: count - 1 },
    viewRows: windowed && height > 0 ? rowsInView(height - HEADER_HEIGHT) : 0,
    pin: setPinned,
    focusIndex,
  };
}
