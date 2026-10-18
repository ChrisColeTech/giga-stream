import { ROWS_FIRST_WINDOW, ROWS_LOOK_AHEAD, ROWS_WINDOW_BUFFER } from "@/lib/library-limits";
import { mayChain } from "@/lib/library-pager";

/* A Rows shelf's horizontal windowing and paging maths (`docs/33` sections 2.4 and 2.5). Pure: no React, DOM or store.
   The numbers are the CSS of `components/library/rows/rows-constants.ts`: a 12 px inline padding and gap, six poster
   columns never under 144 px, two and a half Continue columns. */

export const SHELF_PAD = 12;
export const SHELF_GAP = 12;
export const POSTER_MIN = 144;
const POSTER_SHARE = 6;
const LANDSCAPE_SHARE = 2.5;

/** The distance from one card's left edge to the next, for a row `clientWidth` wide; 0 when the row has no width. */
export function shelfPitch(clientWidth: number, landscape: boolean): number {
  const inner = clientWidth - 2 * SHELF_PAD;
  if (inner <= 0) return 0;
  const column = landscape
    ? (inner - 2 * SHELF_GAP) / LANDSCAPE_SHARE
    : Math.max(POSTER_MIN, (inner - (POSTER_SHARE - 1) * SHELF_GAP) / POSTER_SHARE);
  return column <= 0 ? 0 : column + SHELF_GAP;
}

/** Where a row stands: its horizontal scroll and visible width, in pixels. */
export interface ShelfView {
  readonly scrollLeft: number;
  readonly clientWidth: number;
}

/** The cards to mount, `start` included and `end` excluded. */
export interface CardRange {
  readonly start: number;
  readonly end: number;
}

/** The cards the row's viewport touches, widened by `buffer` cards each side. Unmeasured (null, or no width), the
 *  first `ROWS_FIRST_WINDOW` cards. */
export function shelfRange(
  view: ShelfView | null,
  landscape: boolean,
  count: number,
  buffer: number = ROWS_WINDOW_BUFFER,
): CardRange {
  if (count <= 0) return { start: 0, end: 0 };
  const pitch = view === null ? 0 : shelfPitch(view.clientWidth, landscape);
  if (view === null || pitch <= 0) return { start: 0, end: Math.min(count, ROWS_FIRST_WINDOW) };
  const left = view.scrollLeft - SHELF_PAD;
  const first = Math.min(count - 1, Math.max(0, Math.floor(left / pitch)));
  const last = Math.min(count - 1, Math.max(first, Math.floor((left + view.clientWidth - 1) / pitch)));
  return { start: Math.max(0, first - buffer), end: Math.min(count, last + 1 + buffer) };
}

/** A run of unmounted cards (drawn as one spacer of their width) or one mounted card. */
export type ShelfSegment =
  | { readonly kind: "gap"; readonly cards: number }
  | { readonly kind: "card"; readonly index: number };

/** The row left to right: spacers and mounted cards. A pinned card (the focused one) outside the range is mounted too,
 *  so the row is always as long as `count` cards. */
export function shelfSegments(range: CardRange, pinned: number | null, count: number): ShelfSegment[] {
  const mounted: number[] = [];
  const pin = pinned !== null && pinned >= 0 && pinned < count ? pinned : null;
  if (pin !== null && pin < range.start) mounted.push(pin);
  for (let index = range.start; index < Math.min(range.end, count); index += 1) mounted.push(index);
  if (pin !== null && pin >= range.end) mounted.push(pin);
  const segments: ShelfSegment[] = [];
  let next = 0;
  for (const index of mounted) {
    if (index > next) segments.push({ kind: "gap", cards: index - next });
    segments.push({ kind: "card", index });
    next = index + 1;
  }
  if (count > next) segments.push({ kind: "gap", cards: count - next });
  return segments;
}

/** A horizontal extent in client coordinates. */
export interface HorizontalSpan {
  readonly left: number;
  readonly right: number;
}

/** True when the sentinel lies within the row's box grown by the look-ahead on both sides. A row without width (a
 *  hidden surface) never counts, however its zero-size rects compare. */
export function withinHorizontalLookAhead(
  sentinel: HorizontalSpan,
  row: HorizontalSpan,
  margin: number = ROWS_LOOK_AHEAD,
): boolean {
  if (row.right - row.left <= 0) return false;
  return sentinel.left <= row.right + margin && sentinel.right >= row.left - margin;
}

export interface ShelfPagerState {
  /** The server reported a next page for the shelf. */
  readonly hasMore: boolean;
  /** The shelf's next page is already being read. */
  readonly paging: boolean;
  /** The row's visible width; 0 while hidden or collapsed. */
  readonly rowWidth: number;
  /** The sentinel is within the look-ahead. */
  readonly inRange: boolean;
  /** Pages chained without the user scrolling this row. */
  readonly unscrolled: number;
}

/** Whether the shelf asks for its next page now: there is one, none is loading, the row has layout, its end is near,
 *  and the chain is under its bound (`lib/library-pager.ts`). */
export function shelfWantsPage(state: ShelfPagerState): boolean {
  return state.hasMore && !state.paging && state.rowWidth > 0 && state.inRange && mayChain(state.unscrolled);
}
