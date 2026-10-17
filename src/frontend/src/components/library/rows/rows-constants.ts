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

/** A chevron press moves the row by this share of its visible width. */
export const ROW_SCROLL_FRACTION = 0.8;

/** A row's scroll position counts as an end within this many pixels, for rounding. */
export const EDGE_SLACK_PX = 1;

/** The Rows view draws this many shelves of skeleton cards while it has nothing to show. */
export const SKELETON_SHELVES = 3;
export const SKELETON_SHELF_CARDS = 8;
