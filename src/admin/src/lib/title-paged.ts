import { MAX_PAGES_KEPT, PAGE_SIZE } from "@giga/ui/lib/window-constants";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import type { TitleInventory } from "@/services/schemas/title-stored-schema";

/* The Stored titles list's pages (`docs/41` section 4.3), pure: rows are read a page at a time by offset and kept by page
 * index, the nearest `MAX_PAGES_KEPT` of them. `version` is the store's change marker: a page that answers with another
 * one means the set changed under the pages already held, so those are dropped and the visible ones are read again. */

export interface StoredPaged {
  /** Rows matching the query; null until the first page answers. */
  readonly total: number | null;
  readonly pages: Readonly<Record<number, readonly AdminTitleRow[]>>;
  /** Page indexes in flight. */
  readonly loading: readonly number[];
  readonly version: string | null;
  /** The whole store's counts, whatever the filters. */
  readonly inventory: TitleInventory | null;
}

export const NO_PAGED: StoredPaged = { total: null, pages: {}, loading: [], version: null, inventory: null };

export const pageOf = (index: number, size: number = PAGE_SIZE): number => Math.floor(index / size);

export type StoredPages = StoredPaged["pages"];

/** The row at an index, or undefined while its page is not loaded. */
export function rowIn(pages: StoredPages, index: number, size: number = PAGE_SIZE): AdminTitleRow | undefined {
  return pages[pageOf(index, size)]?.[index % size];
}

export const rowAt = (paged: StoredPaged, index: number, size: number = PAGE_SIZE): AdminTitleRow | undefined =>
  rowIn(paged.pages, index, size);

/** Every loaded row, in page order. */
export function loadedRows(paged: StoredPaged): AdminTitleRow[] {
  return Object.keys(paged.pages)
    .map(Number)
    .sort((a, b) => a - b)
    .flatMap((page) => paged.pages[page] ?? []);
}

export const isLoaded = (paged: StoredPaged, page: number): boolean => paged.pages[page] !== undefined;
export const isLoading = (paged: StoredPaged, page: number): boolean => paged.loading.includes(page);

export const startPage = (paged: StoredPaged, page: number): StoredPaged => ({
  ...paged,
  loading: isLoading(paged, page) ? paged.loading : [...paged.loading, page],
});

export const failPage = (paged: StoredPaged, page: number): StoredPaged => ({
  ...paged,
  loading: paged.loading.filter((one) => one !== page),
});

/** Keeps the `max` pages nearest `centre`; the others are read again when scrolled back to. */
export function evict(
  pages: Readonly<Record<number, readonly AdminTitleRow[]>>,
  centre: number,
  max: number = MAX_PAGES_KEPT,
): Record<number, readonly AdminTitleRow[]> {
  const kept = Object.keys(pages).map(Number);
  if (kept.length <= max) return { ...pages };
  const nearest = kept.sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre)).slice(0, max);
  return Object.fromEntries(nearest.map((page) => [page, pages[page] ?? []]));
}

export interface PageAnswer {
  readonly rows: readonly AdminTitleRow[];
  readonly total: number;
  readonly version: string;
  readonly inventory: TitleInventory;
}

/** A page arrived. Another `version` than the pages held drops those pages (this one is kept). */
export function acceptPage(paged: StoredPaged, page: number, answer: PageAnswer): StoredPaged {
  const changed = paged.version !== null && paged.version !== answer.version;
  const held = changed ? {} : paged.pages;
  return {
    total: answer.total,
    pages: evict({ ...held, [page]: answer.rows }, page),
    loading: paged.loading.filter((one) => one !== page),
    version: answer.version,
    inventory: answer.inventory,
  };
}

/** Drops every page and keeps the total, the marker and the counts: the first page and the visible ones are read again. */
export const dropPages = (paged: StoredPaged): StoredPaged => ({ ...paged, pages: {}, loading: [] });

/** A write's answer replaces the row wherever it is loaded. */
export function patchRow(paged: StoredPaged, row: AdminTitleRow): StoredPaged {
  const pages: Record<number, readonly AdminTitleRow[]> = {};
  for (const [page, rows] of Object.entries(paged.pages)) {
    pages[Number(page)] = rows.some((one) => one.id === row.id) ? rows.map((one) => (one.id === row.id ? row : one)) : rows;
  }
  return { ...paged, pages };
}

/** A deleted row leaves its page and the total falls by one. Rows after it sit one place early until the next read. */
export function removeRow(paged: StoredPaged, id: string): StoredPaged {
  const pages: Record<number, readonly AdminTitleRow[]> = {};
  let found = false;
  for (const [page, rows] of Object.entries(paged.pages)) {
    pages[Number(page)] = rows.filter((one) => one.id !== id);
    found = found || pages[Number(page)]?.length !== rows.length;
  }
  const total = paged.total === null || !found ? paged.total : Math.max(0, paged.total - 1);
  return { ...paged, pages, total };
}
