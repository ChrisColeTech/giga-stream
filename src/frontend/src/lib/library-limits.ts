/** The Library's fixed numbers (`06` section 4): read here, never typed into a component. */

/** Continue Watching shows at most this many cards. */
export const CONTINUE_LIMIT = 10;

/** The second press of a two-step Clear history must land within this many milliseconds of the first. */
export const CLEAR_WINDOW_MS = 4000;

/** Loading and empty draw this many card skeletons (grid) or row skeletons (list). */
export const SKELETON_CARDS = 12;
export const SKELETON_ROWS = 10;

/** The rail draws this many row skeletons while its collections are not there. */
export const RAIL_SKELETON_ROWS = 5;

/** The genre popover offers a search box from this many genres. */
export const SEARCH_MIN_GENRES = 12;

/** Cards whose top edges differ by less than this share one row. */
export const ROW_EPSILON = 2;
