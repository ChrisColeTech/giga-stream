/**
 * The history page slice (docs/61 section 2.5): on the browser runtime history pages client-side
 * at the server's page size, so a local list answers exactly the rows a page of the server's
 * history would. Pages count from the first, page 0, in the order given — newest first for
 * history. Pure slicing; no cursor machinery, which stays the fileserver's own.
 */

/** One page's answer: the rows of the page, and the whole list's length whatever page was asked. */
export interface HistoryPage<T> {
  items: T[];
  total: number;
}

/**
 * One page of `items`: `page` counts from 0 and a page past the end answers no rows while `total`
 * still reports the whole list. A negative page is read as the first, and a size below one (or not
 * a number) cannot hold a row, so it answers an empty page.
 */
export function pageOf<T>(items: readonly T[], page: number, pageSize: number): HistoryPage<T> {
  const size = Math.max(0, pageSize);
  const start = Math.max(0, page) * size;
  return { items: items.slice(start, start + size), total: items.length };
}
