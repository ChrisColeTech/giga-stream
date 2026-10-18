import { CONTINUE_MAX } from "../constants/library.js";
import {
  decodeCursor,
  facetsOf,
  inList,
  matchesFilters,
  orderRows,
  pageOf,
  type LibraryQuery,
  type RowOrder,
} from "../lib/library-query.js";
import type { CachedTitleRepository } from "../store/cached-title-repository.js";
import type { LibraryFileRow, LibraryRepository, LibraryWatchRow } from "../store/library-repository.js";
import type { LibraryItem } from "../types/library.js";
import type { LibraryItems } from "./library-items.js";

/** One materialized row: the item the interface sees, and the keys its sorts compare. */
interface Row {
  item: LibraryItem;
  order: RowOrder;
}

/** A list view's answer parts, before the service adds the whole page's flags. */
export interface ListPage {
  items: LibraryItem[];
  nextCursor?: string;
  total: number;
  facets: { genres: string[]; years: number[] };
}

/** A watch entry whose file row is gone keeps its row, named by its id; no invented facts. */
const lostFile = (id: string): LibraryFileRow => ({ id, title: id, addedAt: 0 });

/**
 * The library's own views (docs/03 section 3.5): history, favorites and a collection, listed from
 * the fileserver's tables. A title's card facts come from the cached list rows (docs/46): no backend call is
 * made, and a title the cache does not hold degrades to a skeleton row, never fails the page.
 */
export function createLibraryLists(deps: {
  repo: LibraryRepository;
  items: LibraryItems;
  titles: CachedTitleRepository;
}) {
  const { repo, items, titles } = deps;

  const filesById = (): Map<string, LibraryFileRow> => new Map(repo.listLocalFiles().map((row) => [row.id, row]));

  /** Title rows with card facts from the cache; an id the cache does not hold is a skeleton. */
  function titleRows(ids: readonly string[]): Map<string, Row> {
    const held = new Map(titles.byIds(ids).map((row) => [row.id, row]));
    const rows = new Map<string, Row>();
    for (const id of ids) {
      const row = held.get(id);
      rows.set(id, row === undefined ? { item: items.skeletonTitle(id), order: {} } : { item: items.titleItem(row), order: { year: row.year } });
    }
    return rows;
  }

  const localRows = (rows: readonly LibraryFileRow[]): Row[] =>
    rows.map((row) => ({ item: items.localItem(row), order: { foundAt: row.addedAt } }));

  /** The distinct title ids of the entries that are titles. */
  const titleIdsOf = (entries: readonly LibraryWatchRow[]): string[] => [
    ...new Set(entries.filter((entry) => entry.itemKind === "title").map((entry) => entry.itemId)),
  ];

  /** `history`: the watch entries, newest first, one row per entry, each with its watch id. */
  function historyRows(): Row[] {
    const entries = repo.listWatchEntries();
    const files = filesById();
    const facts = titleRows(titleIdsOf(entries));
    return entries.map((entry) => {
      const base =
        entry.itemKind === "local"
          ? items.localItem(files.get(entry.itemId) ?? lostFile(entry.itemId))
          : (facts.get(entry.itemId)?.item ?? items.skeletonTitle(entry.itemId));
      return {
        item: { ...base, watchId: entry.id, progress: items.progressOf(entry) },
        order: { watchedAt: entry.updatedAt },
      };
    });
  }

  /** Each item's newest watch entry, newest first (an item with several episodes counts once). */
  function newestPerItem(): LibraryWatchRow[] {
    const seen = new Set<string>();
    return repo.listWatchEntries().filter((entry) => {
      const key = `${entry.itemKind}:${entry.itemId}`;
      return !seen.has(key) && seen.add(key);
    });
  }

  /** Items whose newest watch entry is in `state`, one row each: the history-backed `watched` answer set. */
  function stateRows(state: "watching" | "watched"): Row[] {
    const entries = newestPerItem().filter((entry) => entry.state === state);
    const files = filesById();
    const facts = titleRows(titleIdsOf(entries));
    return entries.flatMap((entry) => {
      const order = { watchedAt: entry.updatedAt };
      if (entry.itemKind === "local") {
        const file = files.get(entry.itemId);
        return file === undefined ? [] : [{ item: items.localItem(file), order }];
      }
      const row = facts.get(entry.itemId);
      return [{ item: row?.item ?? items.skeletonTitle(entry.itemId, entry), order: { ...row?.order, ...order } }];
    });
  }

  /** `favorites`: the favorited items, locals and titles alike. */
  function favoriteRows(): Row[] {
    const members = repo.listFavorites();
    const files = filesById();
    const local = localRows(members.flatMap((m) => (m.kind === "local" ? [files.get(m.itemId) ?? lostFile(m.itemId)] : [])));
    const title = [...titleRows(members.flatMap((m) => (m.kind === "title" ? [m.itemId] : []))).values()];
    return [...local, ...title];
  }

  /** `collection`: the manual members plus the files of its folders, one row per item. */
  function collectionRows(collectionId: string): Row[] {
    const members = repo.listCollectionMembers(collectionId);
    const files = filesById();
    const local = members.flatMap((member) => {
      if (member.kind !== "local") return [];
      const [row] = localRows([files.get(member.itemId) ?? lostFile(member.itemId)]);
      return row === undefined ? [] : [{ ...row, item: { ...row.item, collectionSource: member.source } }];
    });
    const titleMembers = members.filter((member) => member.kind === "title");
    const titleById = titleRows(titleMembers.map((member) => member.itemId));
    const title = titleMembers.flatMap((member) => {
      const row = titleById.get(member.itemId);
      return row === undefined ? [] : [{ ...row, item: { ...row.item, collectionSource: member.source } }];
    });
    return [...local, ...title];
  }

  function view(query: LibraryQuery, rows: Row[]): ListPage {
    const kept = rows.filter((row) => inList(row.item, query) && matchesFilters(row.item, query));
    const sorted = orderRows(kept, query.sort, (row) => row.order, (row) => row.item.title);
    const paged = pageOf(
      sorted.map((row) => row.item),
      query.cursor === undefined ? undefined : decodeCursor(query.cursor),
    );
    return {
      items: paged.items,
      ...(paged.nextCursor !== undefined && { nextCursor: paged.nextCursor }),
      total: kept.length,
      facets: facetsOf(
        kept.map((row) => row.item),
        query,
      ),
    };
  }

  return {
    history: (query: LibraryQuery) => view(query, historyRows()),
    favorites: (query: LibraryQuery) => view(query, favoriteRows()),
    collection: (query: LibraryQuery) => view(query, collectionRows(query.collectionId ?? "")),

    /** `view=all&watched=watching|watched` over the history only: locals first, then titles; `total` is whole. */
    watchedSet(query: LibraryQuery, state: "watching" | "watched"): Omit<ListPage, "facets"> {
      const kept = stateRows(state).filter((row) => inList(row.item, query) && matchesFilters(row.item, query));
      const sortedOf = (rows: Row[]): LibraryItem[] =>
        orderRows(rows, query.sort, (row) => row.order, (row) => row.item.title).map((row) => row.item);
      const sorted = [
        ...sortedOf(kept.filter((row) => row.item.kind === "local")),
        ...sortedOf(kept.filter((row) => row.item.kind !== "local")),
      ];
      const paged = pageOf(sorted, query.cursor === undefined ? undefined : decodeCursor(query.cursor));
      return {
        items: paged.items,
        ...(paged.nextCursor !== undefined && { nextCursor: paged.nextCursor }),
        total: kept.length,
      };
    },

    /** `GET /api/library/continue` (03 section 3.5): the watching rows, newest first, at most ten. */
    continueItems(): LibraryItem[] {
      const files = filesById();
      const watching = newestPerItem().filter((entry) => entry.state === "watching").slice(0, CONTINUE_MAX);
      const facts = titleRows(titleIdsOf(watching));
      return watching.map((entry) => {
        const base =
          entry.itemKind === "local"
            ? items.localItem(files.get(entry.itemId) ?? lostFile(entry.itemId))
            : (facts.get(entry.itemId)?.item ?? items.skeletonTitle(entry.itemId));
        return { ...base, progress: items.progressOf(entry) };
      });
    },
  };
}

export type LibraryLists = ReturnType<typeof createLibraryLists>;
