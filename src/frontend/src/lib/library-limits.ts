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

/** A Rows shelf asks for its next page when its end is this many pixels beyond the row's right edge (`docs/33` 2.4). */
export const ROWS_LOOK_AHEAD = 480;

/** A Rows shelf mounts the cards its viewport touches plus this many each side (`docs/33` section 2.5). */
export const ROWS_WINDOW_BUFFER = 3;

/** A Rows shelf mounts its first this many cards before its row has been measured. */
export const ROWS_FIRST_WINDOW = 9;

/** A Rows shelf draws this many card skeletons at its tail while its next page loads. */
export const ROWS_TAIL_SKELETONS = 4;
