import { CONTINUE_MAX, LIST_FACTS_MAX } from "../constants/library.js";
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
import type { LibraryFileRow, LibraryRepository, LibraryWatchRow } from "../store/library-repository.js";
import type { LibraryItem } from "../types/library.js";
import type { LibraryItems } from "./library-items.js";
import type { TitlesService } from "./titles-service.js";

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
 * the fileserver's tables. A title's card facts come from the session's details — one bounded
 * fetch per row, degraded to a skeleton when the read fails — and Continue Watching's rows.
 */
export function createLibraryLists(deps: {
  repo: LibraryRepository;
  items: LibraryItems;
  titles: TitlesService;
}) {
  const { repo, items, titles } = deps;

  const filesById = (): Map<string, LibraryFileRow> => new Map(repo.listLocalFiles().map((row) => [row.id, row]));

  /** Title rows with card facts: the session's details, or one bounded fetch per view (03 3.5). */
  async function titleRows(ids: readonly string[]): Promise<Map<string, Row>> {
    const facts = await Promise.all(ids.slice(0, LIST_FACTS_MAX).map((id) => titles.cardFacts(id)));
    const rows = new Map<string, Row>();
    ids.forEach((id, at) => {
      const detail = at < LIST_FACTS_MAX ? facts[at] : undefined;
      rows.set(
        id,
        detail === undefined
          ? { item: items.skeletonTitle(id), order: {} }
          : { item: items.detailItem(detail), order: { year: detail.year } },
      );
    });
    return rows;
  }

  const localRows = (rows: readonly LibraryFileRow[]): Row[] =>
    rows.map((row) => ({ item: items.localItem(row), order: { foundAt: row.addedAt } }));

  /** `history`: the watch entries, newest first, one row per entry, each with its watch id. */
  async function historyRows(): Promise<Row[]> {
    const entries = repo.listWatchEntries();
    const files = filesById();
    const facts = await titleRows([...new Set(entries.filter((e) => e.itemKind === "title").map((e) => e.itemId))]);
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

  /** `favorites`: the favorited items, locals and titles alike. */
  async function favoriteRows(): Promise<Row[]> {
    const members = repo.listFavorites();
    const files = filesById();
    const local = localRows(members.flatMap((m) => (m.kind === "local" ? [files.get(m.itemId) ?? lostFile(m.itemId)] : [])));
    const title = [...(await titleRows(members.flatMap((m) => (m.kind === "title" ? [m.itemId] : [])))).values()];
    return [...local, ...title];
  }

  /** `collection`: the manual members plus the files of its folders, one row per item. */
  async function collectionRows(collectionId: string): Promise<Row[]> {
    const members = repo.listCollectionMembers(collectionId);
    const files = filesById();
    const local = members.flatMap((member) => {
      if (member.kind !== "local") return [];
      const [row] = localRows([files.get(member.itemId) ?? lostFile(member.itemId)]);
      return row === undefined ? [] : [{ ...row, item: { ...row.item, collectionSource: member.source } }];
    });
    const titleMembers = members.filter((member) => member.kind === "title");
    const titleById = await titleRows(titleMembers.map((member) => member.itemId));
    const title = titleMembers.flatMap((member) => {
      const row = titleById.get(member.itemId);
      return row === undefined ? [] : [{ ...row, item: { ...row.item, collectionSource: member.source } }];
    });
    return [...local, ...title];
  }

  async function view(query: LibraryQuery, rowsOf: () => Promise<Row[]>): Promise<ListPage> {
    const rows = await rowsOf();
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
    history: (query: LibraryQuery) => view(query, historyRows),
    favorites: (query: LibraryQuery) => view(query, favoriteRows),
    collection: (query: LibraryQuery) => view(query, () => collectionRows(query.collectionId ?? "")),

    /** `GET /api/library/continue` (03 section 3.5): the watching rows, newest first, at most ten. */
    async continueItems(): Promise<LibraryItem[]> {
      const files = filesById();
      const watching: LibraryWatchRow[] = [];
      const seen = new Set<string>();
      for (const entry of repo.listWatchEntries()) {
        const key = `${entry.itemKind}:${entry.itemId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (entry.state === "watching") watching.push(entry);
        if (watching.length === CONTINUE_MAX) break;
      }
      const facts = await titleRows([...new Set(watching.filter((e) => e.itemKind === "title").map((e) => e.itemId))]);
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
