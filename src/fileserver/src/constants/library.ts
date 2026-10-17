/** The library query's named limits (docs/03 section 3.5, `06` section 4.2). */

/** One page's size; the backend's title pages are 20 (03 section 3.5). */
export const LIBRARY_PAGE_SIZE = 20;

/** Upstream title pages one `view=all` request may read to fill a page that filters thin out. */
export const UPSTREAM_PAGES_MAX = 10;

/** The `all` view's years facet runs from this year back this far (03 section 3.5). */
export const FACET_YEARS = 30;

/** Continue Watching answers at most this many rows (03 section 3.5, `06` section 4.2). */
export const CONTINUE_MAX = 10;

/** Title card facts one list view may fetch: the bound that keeps a read bounded (03 section 3.5). */
export const LIST_FACTS_MAX = 100;
