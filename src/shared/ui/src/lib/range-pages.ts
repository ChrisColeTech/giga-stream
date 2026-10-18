import { MAX_UNSCROLLED_PAGES } from "./pager-rules";
import type { RowRange } from "./window-types";
import { PAGER_LOOK_AHEAD, ROW_HEIGHT } from "./window-constants";

/* Index-addressed paging (`docs/41` section 4.2): loading is driven by the rows the window shows, not by a sentinel at
   the end, so a scrollbar drag to the middle fetches the middle. Pure: the hook `useRangePager` supplies what is loaded
   and what is in flight. */

/** The rows beyond each edge of the window whose pages are asked for early: the 240px look-ahead in rows. */
export const LOOK_AHEAD_ROWS = Math.ceil(PAGER_LOOK_AHEAD / ROW_HEIGHT);

/** The first and last row index of a page, clamped to the list. */
export function pageSpan(page: number, pageSize: number, total: number): RowRange {
  const first = page * pageSize;
  return { first, last: Math.min(Math.max(0, total) - 1, first + pageSize - 1) };
}

/** The pages that hold rows `first` to `last` (inclusive), clamped to the list. */
export function pagesForRange(first: number, last: number, pageSize: number, total: number): number[] {
  if (total <= 0 || pageSize <= 0) return [];
  const from = Math.max(0, Math.min(first, total - 1));
  const to = Math.max(0, Math.min(last, total - 1));
  if (to < from) return [];
  const pages: number[] = [];
  for (let page = Math.floor(from / pageSize); page <= Math.floor(to / pageSize); page += 1) pages.push(page);
  return pages;
}

export interface PageAsk {
  /** The mounted rows (the viewport and its overscan). */
  readonly range: RowRange;
  /** Rows the viewport shows: bounds the pages one evaluation may ask for. */
  readonly visibleRows: number;
  readonly total: number;
  readonly pageSize: number;
  /** Pages already asked for without the person scrolling since. */
  readonly unscrolled: number;
  readonly isLoaded: (page: number) => boolean;
  readonly inFlight: ReadonlySet<number>;
}

/** The pages one evaluation asks for, nearest the viewport first: those the window and its look-ahead touch that are
 *  neither loaded nor in flight, at most `ceil(visible / pageSize) + 2` (a viewport touches one or two pages plus the
 *  look-ahead page), and never past the chain bound of `MAX_UNSCROLLED_PAGES` unscrolled requests. */
export function pagesToRequest(ask: PageAsk): number[] {
  if (ask.range.last < ask.range.first) return [];
  const budget = Math.min(
    Math.ceil(Math.max(1, ask.visibleRows) / ask.pageSize) + 2,
    MAX_UNSCROLLED_PAGES - ask.unscrolled,
  );
  if (budget <= 0) return [];
  const wanted = pagesForRange(ask.range.first - LOOK_AHEAD_ROWS, ask.range.last + LOOK_AHEAD_ROWS, ask.pageSize, ask.total);
  const centre = (ask.range.first + ask.range.last) / 2;
  const distance = (page: number): number => {
    const span = pageSpan(page, ask.pageSize, ask.total);
    return centre < span.first ? span.first - centre : centre > span.last ? centre - span.last : 0;
  };
  return wanted
    .filter((page) => !ask.isLoaded(page) && !ask.inFlight.has(page))
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, budget);
}
