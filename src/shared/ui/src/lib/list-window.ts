import { gridStep, visibleRows } from "./window-rows";
import type { RowLayout, RowRange } from "./window-types";
import { HEADER_HEIGHT, LIST_MIN_HEIGHT, LIST_PAGE_MARGIN, OVERSCAN_ROWS, ROW_HEIGHT } from "./window-constants";

/* The one-column case of the windowing maths (`docs/41` section 4.2): a record list of fixed 36px rows under a sticky
   header. Pure; the hook `useWindowedList` feeds it measurements. */

/** One column of 36px rows with no gap between them. */
export const LIST_LAYOUT: RowLayout = { columns: 1, rowHeight: ROW_HEIGHT, pitch: ROW_HEIGHT };

/** The rows to mount for a viewport `height` tall whose top edge is `top` pixels into the rows. */
export function listRange(top: number, height: number, count: number): RowRange {
  return visibleRows({ top, height }, LIST_LAYOUT, count, OVERSCAN_ROWS);
}

/** How many whole rows a viewport of `height` shows (at least one): the PageUp / PageDown step. */
export function rowsInView(height: number): number {
  return Math.max(1, Math.floor(Math.max(0, height) / ROW_HEIGHT));
}

/** The windowed list's own height: its content up to the room the page offers, never under the minimum. `pageHeight`
 *  is the page scroller's client height, 0 while it is unknown (server rendering, a hidden tab). */
export function listHeight(total: number, pageHeight: number): number {
  const content = Math.max(0, total) * ROW_HEIGHT + HEADER_HEIGHT;
  return Math.min(content, Math.max(LIST_MIN_HEIGHT, pageHeight - LIST_PAGE_MARGIN));
}

/** The row a key moves focus to, by index, so it reaches rows that are not mounted: the arrows, Home and End as
 *  `gridStep` with one column, and PageUp / PageDown by a viewport of rows, clamped to the ends. Null: not a movement
 *  key, or already at that end. */
export function listStep(key: string, index: number, pageRows: number, count: number): number | null {
  if (key !== "PageUp" && key !== "PageDown") return gridStep(key, index, 1, count);
  if (index < 0 || index >= count) return null;
  const step = Math.max(1, pageRows);
  const to = key === "PageUp" ? Math.max(0, index - step) : Math.min(count - 1, index + step);
  return to === index ? null : to;
}

/** The scroll offset a measurement should keep. A surface shown again may have lost its hidden scroller's offset; the
 *  last one seen while it was visible is put back. A visible surface keeps whatever it has. */
export function restoredTop(memory: { readonly hidden: boolean; readonly lastTop: number }, scrollTop: number): number {
  return memory.hidden && Math.abs(scrollTop - memory.lastTop) > 1 ? memory.lastTop : scrollTop;
}

/** Two ranges mount the same rows. */
export function sameRange(a: RowRange, b: RowRange): boolean {
  return a.first === b.first && a.last === b.last;
}
