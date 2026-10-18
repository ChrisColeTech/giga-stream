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

/* The columns of the skeleton shelves (`06` section 4, Rows). A column is its share of the shelf's width, so six poster
   cards fill the rail at any width, with a 12 px gap (`gap-3`, 0.75rem) between them. A share never drops below the
   grid's 144 px minimum (`06` section 4.2): on a narrow rail the row scrolls instead of shrinking its cards. */
export const ROW_GAP = "gap-3";
export const POSTER_COLUMNS = "auto-cols-[minmax(144px,calc((100%_-_3.75rem)/6))]";

/* A real shelf row is a flex track of the same widths (`docs/33` section 2.5), so blank spacers can stand for the cards
   that are not mounted. Percentages are of the row's content box. Five gaps sit between six poster columns, two
   between two and a half Continue Watching cards. `lib/shelf-window.ts` holds the same numbers for its maths. */
const POSTER_CARD = "max(144px, (100% - 3.75rem) / 6)";
const LANDSCAPE_CARD = "((100% - 1.5rem) / 2.5)";
const GAP = "0.75rem";

/** The CSS width of one card. */
export function cardWidth(landscape: boolean): string {
  return `calc(${landscape ? LANDSCAPE_CARD : POSTER_CARD})`;
}

/** The CSS width of a spacer standing for `cards` unmounted cards: their widths and the gaps between them. */
export function spacerWidth(cards: number, landscape: boolean): string {
  return `calc(${cards} * (${landscape ? LANDSCAPE_CARD : POSTER_CARD} + ${GAP}) - ${GAP})`;
}

/** A chevron press moves the row by this share of its visible width: one row width. */
export const ROW_SCROLL_FRACTION = 1;

/** A row's scroll position counts as an end within this many pixels, for rounding. */
export const EDGE_SLACK_PX = 1;

/** The Rows view draws this many shelves of skeleton cards while it has nothing to show. */
export const SKELETON_SHELVES = 3;
export const SKELETON_SHELF_CARDS = 8;
