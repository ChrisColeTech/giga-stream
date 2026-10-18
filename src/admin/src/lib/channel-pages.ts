import { MAX_PAGES_KEPT, PAGE_SIZE } from "@giga/ui/lib/window-constants";

/* The loaded pages of a paged list (`41` section 4.3), pure and generic over the row: pages by index, the version they
 * were read at, the rule that a changed version drops the others, eviction past `MAX_PAGES_KEPT`, and the row edits a
 * write's answer makes. A page's rows are kept as read; the slice owns everything else. */

export type Pages<Row> = Readonly<Record<number, readonly Row[]>>;

export interface PageSet<Row> {
  readonly pages: Pages<Row>;
  /** The revision the pages were read at; null before any page. */
  readonly version: number | null;
}

export const EMPTY_PAGES: PageSet<never> = { pages: {}, version: null };

/** The row at a position, or undefined while its page is not loaded. */
export function rowAt<Row>(pages: Pages<Row>, index: number, size: number = PAGE_SIZE): Row | undefined {
  return pages[Math.floor(index / size)]?.[index % size];
}

/** Every loaded row, in list order. */
export function loadedRows<Row>(pages: Pages<Row>): Row[] {
  return Object.keys(pages)
    .map(Number)
    .sort((a, b) => a - b)
    .flatMap((index) => pages[index] ?? []);
}

/** Drops the pages farthest from `centre` until at most `max` remain. */
export function evict<Row>(pages: Pages<Row>, centre: number, max: number = MAX_PAGES_KEPT): Pages<Row> {
  const indexes = Object.keys(pages).map(Number);
  if (indexes.length <= max) return pages;
  const keep = new Set(indexes.sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre)).slice(0, max));
  return Object.fromEntries(Object.entries(pages).filter(([index]) => keep.has(Number(index))));
}

/** A page arrived. When the answer's version differs from the pages already held, the set changed under them: they are
 *  all dropped and this page stands alone (the window re-reads the rest). */
export function acceptPage<Row>(set: PageSet<Row>, index: number, rows: readonly Row[], version: number): PageSet<Row> {
  const held = set.version === null || set.version === version ? set.pages : {};
  return { pages: evict({ ...held, [index]: rows }, index), version };
}

/** All pages dropped, the version forgotten: the next evaluation of the window reads what it shows. */
export const dropPages = <Row>(): PageSet<Row> => EMPTY_PAGES;

/** The row with this id replaced wherever it is loaded; the same object when it is not. */
export function patchRow<Row>(pages: Pages<Row>, row: Row, idOf: (row: Row) => string): Pages<Row> {
  const id = idOf(row);
  let changed = false;
  const next: Record<number, readonly Row[]> = {};
  for (const [key, rows] of Object.entries(pages)) {
    const at = rows.findIndex((one) => idOf(one) === id);
    changed = changed || at !== -1;
    next[Number(key)] = at === -1 ? rows : rows.map((one, i) => (i === at ? row : one));
  }
  return changed ? next : pages;
}

export const hasRow = <Row>(pages: Pages<Row>, id: string, idOf: (row: Row) => string): boolean =>
  Object.values(pages).some((rows) => rows.some((row) => idOf(row) === id));

/** A deleted row leaves its page. The positions after it are one off until the pages are read again (the owner of the
 *  delete drops them once, when its run ends), so a run of deletes does not read a page for each. */
export function removeRow<Row>(pages: Pages<Row>, id: string, idOf: (row: Row) => string): Pages<Row> {
  if (!hasRow(pages, id, idOf)) return pages;
  return Object.fromEntries(Object.entries(pages).map(([key, rows]) => [key, rows.filter((row) => idOf(row) !== id)]));
}
