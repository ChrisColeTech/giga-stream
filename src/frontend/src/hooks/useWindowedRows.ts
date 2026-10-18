import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { OVERSCAN_ROWS } from "@/constants/library-window";
import {
  anchorOf, rowCount, rowLayout, scrollTopForAnchor, scrollTopToReveal, visibleRows, windowSegments,
} from "@/lib/window-rows";
import type { RowLayout, RowRange, RowSpec, ScrollAnchor, WindowSegment } from "@/types/window-rows";

/** The size to draw with before the first measurement (and in server rendering, which never measures). */
export interface Measured {
  readonly width: number;
  readonly viewport: number;
}

export interface Frame {
  readonly layout: RowLayout;
  readonly range: RowRange;
}

export interface WindowedRows {
  readonly container: RefObject<HTMLDivElement | null>;
  readonly layout: RowLayout | null;
  readonly segments: readonly WindowSegment[];
  /** Remembers the card focus is on, so its row stays mounted. */
  readonly pin: (index: number) => void;
  /** Scrolls an item's row into the window, then focuses its primary button. */
  readonly focusIndex: (index: number) => void;
}

const sameFrame = (a: Frame | null, b: Frame): boolean =>
  a !== null && a.layout.columns === b.layout.columns && a.layout.pitch === b.layout.pitch
  && a.range.first === b.range.first && a.range.last === b.range.last;

/** The windowing engine of one scroller (`docs/32` section 2.2): it measures with a ResizeObserver and the scroller's
 *  scroll events (no timers), and answers which rows to mount. A zero size is a hidden surface and changes nothing. */
export function useWindowedRows(
  count: number,
  spec: RowSpec,
  scroller: RefObject<HTMLElement | null>,
  measured?: Measured,
): WindowedRows {
  const container = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<Frame | null>(() => {
    if (measured === undefined) return null;
    const layout = rowLayout(measured.width - 2 * spec.padX, spec);
    const range = visibleRows({ top: 0, height: measured.viewport }, layout, rowCount(count, layout.columns), OVERSCAN_ROWS);
    return { layout, range };
  });
  const [pinned, setPinned] = useState<number | null>(null);
  const live = useRef({ frame, count, hidden: false, lastTop: 0, anchor: null as ScrollAnchor | null, focus: -1 });
  live.current.frame = frame;
  live.current.count = count;

  const gridTop = useCallback((root: HTMLElement, node: HTMLElement): number =>
    node.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop + spec.padTop, [spec]);

  const measure = useCallback((): void => {
    const root = scroller.current;
    const node = container.current;
    if (root === null || node === null) return;
    const width = node.getBoundingClientRect().width;
    if (width === 0 || root.clientHeight === 0) {
      live.current.hidden = true;
      return;
    }
    const state = live.current;
    const layout = rowLayout(width - 2 * spec.padX, spec);
    const previous = state.frame?.layout ?? null;
    const reflow = previous !== null && (previous.columns !== layout.columns || previous.pitch !== layout.pitch);
    /* A surface shown again: a browser may have dropped the hidden scroller's offset; put the last one back. */
    const top = state.hidden && Math.abs(root.scrollTop - state.lastTop) > 1 && !reflow ? state.lastTop : root.scrollTop;
    if (top !== root.scrollTop) root.scrollTop = top;
    const origin = gridTop(root, node);
    if (reflow && previous !== null) state.anchor = anchorOf((state.hidden ? state.lastTop : top) - origin, previous);
    state.hidden = false;
    state.lastTop = root.scrollTop;
    const range = visibleRows(
      { top: root.scrollTop - origin, height: root.clientHeight }, layout, rowCount(state.count, layout.columns),
      OVERSCAN_ROWS,
    );
    const next: Frame = { layout, range };
    setFrame((current) => (sameFrame(current, next) ? current : next));
  }, [scroller, spec, gridTop]);

  /* The scroller is the parent of this list, so React attaches its ref only after this hook's layout effects have run:
     on a first render that mounts scroller and list together (Rows to Grid) it is still null then. Follow the live
     element in state, read after every commit (passive effects run once all refs are attached), so the listener and
     observer bind to the element that really scrolls and re-bind when it changes. */
  const [root, setRoot] = useState<HTMLElement | null>(null);
  useEffect(() => { setRoot(scroller.current); });
  useLayoutEffect(() => {
    const node = container.current;
    if (root === null || node === null) return undefined;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => measure());
    observer?.observe(root);
    observer?.observe(node);
    root.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => {
      observer?.disconnect();
      root.removeEventListener("scroll", measure);
    };
  }, [root, measure]);
  useLayoutEffect(() => measure(), [count, measure]);

  const tryFocus = useCallback((): void => {
    const index = live.current.focus;
    const button = index < 0 ? null
      : container.current?.querySelector<HTMLElement>(`[data-index="${index}"] [data-primary]`) ?? null;
    if (button === null) return;
    live.current.focus = -1;
    button.focus({ preventScroll: true });
  }, []);

  /* After a re-flow the new row heights are in the DOM (the browser would clamp a larger offset to the old height):
     put the anchored item back, then draw the range for the new offset. Also the place a pending focus lands. */
  useLayoutEffect(() => {
    const root = scroller.current;
    const node = container.current;
    const anchor = live.current.anchor;
    if (frame !== null && anchor !== null && root !== null && node !== null) {
      live.current.anchor = null;
      root.scrollTop = scrollTopForAnchor(anchor, frame.layout, gridTop(root, node));
      measure();
    }
    tryFocus();
  }, [frame, pinned, scroller, gridTop, measure, tryFocus]);

  const focusIndex = useCallback((index: number): void => {
    const root = scroller.current;
    const node = container.current;
    const layout = live.current.frame?.layout;
    if (root === null || node === null || layout === undefined || index < 0 || index >= live.current.count) return;
    live.current.focus = index;
    const origin = gridTop(root, node);
    const top = scrollTopToReveal(index, layout, { top: root.scrollTop, height: root.clientHeight }, origin);
    if (top !== root.scrollTop) root.scrollTop = top;
    measure();
    tryFocus();
  }, [scroller, gridTop, measure, tryFocus]);

  const rows = frame === null ? 0 : rowCount(count, frame.layout.columns);
  const pinnedRow = pinned === null || frame === null ? null : Math.floor(pinned / frame.layout.columns);
  const segments = frame === null ? [] : windowSegments(frame.range, pinnedRow, rows, frame.layout);
  return { container, layout: frame?.layout ?? null, segments, pin: setPinned, focusIndex };
}
