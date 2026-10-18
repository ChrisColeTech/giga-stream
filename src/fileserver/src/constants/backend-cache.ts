/** The backend cache's numbers (docs/46 sections B and C, docs/03 section 5). */

/** A synced dataset is fresh for this long; staleness is checked on launch and on reads, never by a timer. */
export const CACHE_WINDOW_MS = 6 * 60 * 60 * 1000;

/** A dataset whose last attempt failed is not due again for this long, unless the person asks. */
export const CACHE_RETRY_GAP_MS = 5 * 60 * 1000;

/** The titles catalog read: rows per page and the hard cap on rows one walk accepts. */
export const CATALOG_PAGE_SIZE = 500;
export const CATALOG_ROWS_MAX = 200_000;

/** The first characters of the sha256 of the normalized admin address that name a backend. */
export const SOURCE_KEY_LENGTH = 16;
