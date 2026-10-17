/** The Library's fixed numbers (`06` section 4): read here, never typed into a component. */

/** Continue Watching shows at most this many cards. */
export const CONTINUE_LIMIT = 10;

/** Loading and empty draw this many card skeletons (grid) or row skeletons (list). */
export const SKELETON_CARDS = 12;
export const SKELETON_ROWS = 10;

/** One page of titles holds this many (the fileserver's LIBRARY_PAGE_SIZE, which cuts every page); the pager draws this
 *  many card skeletons while the next page is on its way. */
export const LIBRARY_PAGE_SIZE = 20;

/** The rail draws this many row skeletons while its collections are not there. */
export const RAIL_SKELETON_ROWS = 5;

/** The genre popover offers a search box from this many genres. */
export const SEARCH_MIN_GENRES = 12;

/** The Library asks for the next page when the end of the list is this many pixels from the scroller's edge. */
export const PAGER_LOOK_AHEAD = 240;

/** Cards whose top edges differ by less than this share one row. */
export const ROW_EPSILON = 2;

/** The Rows view groups the first this many items of the query (`docs/33` section 3.1): three All pages (40 each) or
 *  six single-kind pages (20 each), far over what six genre shelves of three titles need. */
export const ROWS_READ_ITEMS = 120;

/** A shelf in the Rows view mounts at most this many cards; See all opens the grid for the rest. */
export const ROWS_SHELF_CARDS = 10;
