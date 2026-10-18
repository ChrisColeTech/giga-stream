import { gridStep } from "./window-rows";
import type { RowLayout, RowRange } from "./window-types";
import { ROW_HEIGHT } from "./window-constants";

/* The pure parts of a record table's row window (`docs/45` section 2.1, ported from `list-window`): one column of 36px
   rows under a sticky header, which rows a key moves to, which offset a surface shown again keeps. The virtualizer
   (`useRowWindow`) decides what is mounted; these decide the rest. */

/** One column of 36px rows with no gap between them. */
export const LIST_LAYOUT: RowLayout = { columns: 1, rowHeight: ROW_HEIGHT, pitch: ROW_HEIGHT };

/** How many whole rows a viewport of `height` shows (at least one): the PageUp / PageDown step. */
export function rowsInView(height: number): number {
  return Math.max(1, Math.floor(Math.max(0, height) / ROW_HEIGHT));
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

/** The indexes to mount: the virtualizer's own, plus the focused row while focus is in it (kept mounted wherever it is). */
export function withPinned(base: readonly number[], pinned: number | null, count: number): number[] {
  if (pinned === null || pinned < 0 || pinned >= count || base.includes(pinned)) return [...base];
  return [...base, pinned].sort((a, b) => a - b);
}

/** The rows the window mounts: the virtualizer's visible range widened by `overscan` each side, clamped to the list;
 *  empty (`last < first`) while the list has no rows or the surface is hidden (no range). */
export function mountedRange(
  visible: { readonly startIndex: number; readonly endIndex: number } | null,
  count: number,
  overscan: number,
): RowRange {
  if (visible === null || count <= 0) return { first: 0, last: -1 };
  return { first: Math.max(0, visible.startIndex - overscan), last: Math.min(count - 1, visible.endIndex + overscan) };
}
