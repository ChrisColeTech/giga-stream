/* The windowed list's fixed numbers (`docs/41` sections 2 and 4.1): read here, never typed into a component. */

/** A record row: `RecordGridRow`'s `h-9`. */
export const ROW_HEIGHT = 36;

/** The record grid's header: `py-1.5` twice (12), one `text-xs` line (16) and its hairline (1). */
export const HEADER_HEIGHT = 29;

/** A list of more rows than this is windowed; at or under it the plain grid draws every row. */
export const WINDOW_MIN_ROWS = 100;

/** Rows per server page (the backends allow up to 200). */
export const PAGE_SIZE = 100;

/** The windowed list's scroller is never shorter than this (eight rows and the header)... */
export const LIST_MIN_HEIGHT = 288;

/** ...and otherwise the page's height less this, so the page around it keeps a margin to scroll in. */
export const LIST_PAGE_MARGIN = 96;

/** Pages a paged list keeps in memory (3,000 rows of 100). */
export const MAX_PAGES_KEPT = 30;

/** Rows mounted beyond the visible ones, on each side. Rows, not pixels, so the mounted count follows the window. */
export const OVERSCAN_ROWS = 2;

/** A page is asked for when it is this many pixels beyond the viewport's edge. */
export const PAGER_LOOK_AHEAD = 240;
