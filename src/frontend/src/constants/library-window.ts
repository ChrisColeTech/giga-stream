import type { RowSpec } from "@/types/window-rows";

/** Rows mounted beyond the visible ones, on each side. Rows, not pixels, so the number of mounted cards depends on the
 *  window's area and the column count, never on the window's height in pixels or the scroll depth (`docs/32`). */
export const OVERSCAN_ROWS = 2;

/** The poster grid: Tailwind `gap-3 p-3`, columns `minmax(144px, 1fr)` (`06` section 4.2). The chrome is the card's
 *  `gap-1` (4) + title line `text-sm` (20) + `gap-1` (4) + the verb row `h-6` (24). */
export const GRID_SPEC: RowSpec = {
  padX: 12,
  padTop: 12,
  gap: 12,
  minColumn: 144,
  artAspect: 1.5,
  chrome: 52,
};

/** The list: Tailwind `gap-1 p-2`; a row is 54px of thumbnail (a 36px column at 2:3), `py-1.5` twice and its 1px border
 *  twice: 68. */
export const LIST_SPEC: RowSpec = {
  padX: 8,
  padTop: 8,
  gap: 4,
  minColumn: 0,
  artAspect: 0,
  chrome: 0,
  fixedHeight: 68,
};
