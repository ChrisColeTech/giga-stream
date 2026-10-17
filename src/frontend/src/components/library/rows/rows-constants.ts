/** The Rows view's copy and numbers (`06` section 4). Read here, never typed into a component. */

export const ROWS_COPY = {
  seeAll: "See all",
  scrollBack: "Scroll left",
  scrollForward: "Scroll right",
  atStart: "The row is already at its start.",
  atEnd: "The row is already at its end.",
  listLabel: "Titles",
  showInGrid: (name: string): string => `Show ${name} in the grid.`,
} as const;

/* The columns of a shelf row (`06` section 4, Rows). Widths are shares of the shelf's own width, never fixed sizes:
   a 12 px gap (`gap-3`, 0.75rem) between columns, six poster cards across the rail at the default width, and two and a
   half Continue Watching cards per 1000 px. Five gaps sit between six poster columns, two between two and a half. */
export const ROW_GAP = "gap-3";
export const POSTER_COLUMNS = "auto-cols-[calc((100%_-_3.75rem)/6)]";
export const LANDSCAPE_COLUMNS = "auto-cols-[calc((100%_-_1.5rem)/2.5)]";

/** A chevron press moves the row by this share of its visible width. */
export const ROW_SCROLL_FRACTION = 0.8;

/** A row's scroll position counts as an end within this many pixels, for rounding. */
export const EDGE_SLACK_PX = 1;

/** The Rows view draws this many shelves of skeleton cards while it has nothing to show. */
export const SKELETON_SHELVES = 3;
export const SKELETON_SHELF_CARDS = 8;
