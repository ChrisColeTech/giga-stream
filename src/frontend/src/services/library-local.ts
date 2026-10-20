import { itemIdentity, type WatchEntry } from "@giga/watch/entry";
import { newestFirst, newestPerItem } from "@giga/watch/order";
import { pageOf } from "@giga/watch/page";
import { CONTINUE_LIMIT, LIBRARY_PAGE_SIZE } from "@/lib/library-limits";
import { itemKey } from "@/lib/library-marks";
import { matchesQuery, type LibraryQuery } from "@/lib/library-query";
import { markOf, type WatchMark } from "@/lib/watch-marks";
import { useAppStore } from "@/store/app-store";
import { sharedLocalWatch } from "@/services/local-watch";
import { readTitle } from "@/services/titles";
import type { Title } from "@/services/schemas/title-schema";
import type { LibraryItem, LibraryPage } from "@/types/library";

/** The browser runtime's library joins (`61` sections 2.5 and 2.6): the catalog pages still come from
 *  `GET /api/library`, and the watch truth - the rows' progress marks, Continue watching and History - is computed
 *  here from the local entries through `src/shared/watch`, joined to the store's title memory with
 *  `GET /api/titles/:id` as the fallback for an entry whose title was never read. A title neither memory nor the
 *  fallback can name keeps its row as the id's readable skeleton, the fileserver's own precedent for a row whose
 *  facts are not held; no fact is invented. History pages client-side at the server's page size. */

/** The marks the local entries hold for catalog rows: each item's newest entry (the shared per-item rule) as the
 *  item key's mark, the same shape a write answer leaves in the store. */
export function watchMarksOfEntries(entries: readonly WatchEntry[]): ReadonlyMap<string, WatchMark> {
  return new Map(newestPerItem(entries).map((entry) => [itemIdentity(entry), markOf(entry)]));
}

/** A row wearing this runtime's watch truth in place of whatever the server attached (its own store's state, which
 *  the browser does not share): the item's newest local mark, or none. */
export function decorateItem(item: LibraryItem, marks: ReadonlyMap<string, WatchMark>): LibraryItem {
  const mark = marks.get(itemKey(item.ref));
  return { ...item, watchId: mark?.watchId, progress: mark?.progress };
}

/** A fetched page of catalog rows wearing the local watch marks. */
export async function decoratedLibraryPage(page: LibraryPage): Promise<LibraryPage> {
  const entries = await (await sharedLocalWatch()).entries();
  const marks = watchMarksOfEntries(entries);
  return { ...page, items: page.items.map((item) => decorateItem(item, marks)) };
}

/** A title detail as a row's card facts; the row joins the store's memory so the next read hits it. */
function titleItemOf(detail: Title): LibraryItem {
  return {
    ref: { kind: "title", id: detail.id },
    kind: detail.kind,
    title: detail.title,
    genres: [...detail.genres],
    favorite: false,
    ...(detail.year === undefined ? {} : { year: detail.year }),
    ...(detail.rating === undefined ? {} : { rating: detail.rating }),
    ...(detail.posterUrl === undefined ? {} : { posterUrl: detail.posterUrl }),
  };
}

/** A title whose facts cannot be had: the id's readable form and no invented facts. */
function skeletonTitle(titleId: string): LibraryItem {
  return {
    ref: { kind: "title", id: titleId },
    kind: titleId.startsWith("tv-") ? "tv" : "movie",
    title: titleId,
    genres: [],
    favorite: false,
  };
}

/** A local file's entry whose file row was never read: the row named by its id, as the fileserver answers. */
function lostLocal(id: string): LibraryItem {
  return { ref: { kind: "local", id }, kind: "local", title: id, genres: [], favorite: false };
}

/** The fallback: the title's own detail, remembered into the store's memory, or nothing when it cannot be had. */
async function titleRow(titleId: string, signal?: AbortSignal): Promise<LibraryItem | undefined> {
  try {
    const item = titleItemOf(await readTitle(titleId, signal));
    useAppStore.getState().rememberLibraryItems([item]);
    return item;
  } catch {
    return undefined;
  }
}

/** One entry as a history or Continue row: the item's card facts with the entry's own progress and watch id. */
async function entryRow(
  entry: WatchEntry,
  memory: ReadonlyMap<string, LibraryItem>,
  signal?: AbortSignal,
): Promise<LibraryItem> {
  const known = memory.get(itemKey(entry.item));
  const base = known ?? (entry.item.kind === "local"
    ? lostLocal(entry.item.id)
    : (await titleRow(entry.item.id, signal)) ?? skeletonTitle(entry.item.id));
  const mark = markOf(entry);
  return { ...base, watchId: mark.watchId, progress: mark.progress };
}

async function rowsForEntries(entries: readonly WatchEntry[], signal?: AbortSignal): Promise<LibraryItem[]> {
  const memory = new Map(useAppStore.getState().libraryItems.map((item) => [itemKey(item.ref), item]));
  return Promise.all(entries.map((entry) => entryRow(entry, memory, signal)));
}

/** The Continue strip's rows: the shared selection over the local entries, joined to the title memory. */
export async function readLocalContinue(signal?: AbortSignal): Promise<LibraryItem[]> {
  const entries = await (await sharedLocalWatch()).continueSelection(CONTINUE_LIMIT);
  return rowsForEntries(entries, signal);
}

const pageNumber = (cursor: string | undefined): number => {
  if (cursor === undefined) return 0;
  const page = Number.parseInt(cursor, 10);
  return Number.isFinite(page) && page > 0 ? page : 0;
};

function facetsOfRows(rows: readonly LibraryItem[], query: LibraryQuery): LibraryPage["facets"] {
  const genres = new Set<string>(query.genres);
  const years = new Set<number>(query.year === "" ? [] : [Number(query.year)]);
  for (const row of rows) {
    for (const genre of row.genres) genres.add(genre);
    if (row.year !== undefined) years.add(row.year);
  }
  return {
    genres: [...genres].sort((one, other) => one.localeCompare(other)),
    years: [...years].sort((one, other) => other - one),
  };
}

/** The local answer for the views the fileserver computes from its watch table: History (one row per entry, newest
 *  first) and the watching and watched sets (one row per item, the item's newest entry counting). The rows are
 *  narrowed by the query exactly as the grid's own filters read them - the watched filter cannot be honored here,
 *  which is why its control is disabled in this runtime - and paged at the server's page size. */
export async function readLocalHistory(
  query: LibraryQuery,
  state: "all" | "watching" | "watched",
  signal?: AbortSignal,
  cursor?: string,
): Promise<LibraryPage> {
  const entries = await (await sharedLocalWatch()).entries();
  const selected = state === "all"
    ? newestFirst(entries)
    : newestPerItem(entries).filter((entry) => entry.state === state);
  const rows = await rowsForEntries(selected, signal);
  const narrowed = rows.filter((row) => matchesQuery({ ...row, collectionIds: [], collectionSources: {} },
    { ...query, watched: "all" }));
  const page = pageNumber(cursor);
  const answer = pageOf(narrowed, page, LIBRARY_PAGE_SIZE);
  const nextCursor = page * LIBRARY_PAGE_SIZE + answer.items.length < answer.total
    ? String(page + 1)
    : undefined;
  return {
    items: answer.items,
    total: answer.total,
    ...(nextCursor === undefined ? {} : { nextCursor }),
    facets: facetsOfRows(narrowed, query),
    trending: false,
    titlesAvailable: true,
  };
}
