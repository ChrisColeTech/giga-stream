import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { libraryRenderState } from "@/lib/library-render-state";
import { resolveItems, type HistoryMarks, type ResolvedItem } from "@/lib/library-marks";
import type { LibraryQuery } from "@/lib/library-query";
import { revealedShelves, shelfCount, type ShelfLoads } from "@/lib/rows-reveal";
import { planShelves, type ShelfSpec } from "@/lib/rows-shelves";
import { libraryQueryKey, readLibrary } from "@/services/library";
import { RowsReader, type RowsReaderSeams } from "@/services/rows-reader";
import { useAppStore } from "@/store/app-store";
import type { CollectionRow } from "@/types/collection";
import type { LibraryData } from "./useLibraryData";

export interface RowsShelvesArgs {
  /** The Rows view is the shown view of the shown surface: only then is a plan started. */
  readonly enabled: boolean;
  readonly query: LibraryQuery;
  readonly data: LibraryData;
  readonly collections: readonly CollectionRow[];
  readonly history: HistoryMarks;
  readonly showContinue: boolean;
}

/** One shown shelf: its plan entry and what it has read, with the Library's marks applied. */
export interface RowsShelfView {
  readonly spec: ShelfSpec;
  readonly items: readonly ResolvedItem[];
  /** The heading's count: the server's total when known, else the cards loaded. */
  readonly count: number;
  /** The server reported a next page. */
  readonly hasMore: boolean;
  readonly paging: boolean;
}

export interface RowsShelves {
  /** The shown shelves, or null while the Rows view shows its skeleton. */
  readonly shelves: readonly RowsShelfView[] | null;
  /** Asks for a shelf's next page; answers whether one was asked for. */
  readonly loadMore: (id: string) => boolean;
  /** Each shelf's horizontal scroll, by shelf id, kept for the plan (`docs/33` section 2.7). */
  readonly positions: Map<string, number>;
}

interface Plan {
  readonly key: string;
  readonly specs: readonly ShelfSpec[];
}

const SEAMS: RowsReaderSeams = {
  read: readLibrary,
  remember: (items) => useAppStore.getState().rememberLibraryItems(items),
  say: (sentence) => useAppStore.getState().say(sentence, "warn"),
};

/** The Rows view's shelves (`docs/33` section 2). The shelf list is planned once per invalidation key, from the main
 *  query's first page (its genre facets) and the collections, then every shelf reads its own first page; the view
 *  reveals when all have answered, and the shown shelves never change for the key. Next pages are read per shelf, on
 *  request. A changed key, or a first-page read of the main query (Refresh), drops the plan: the skeleton again. */
export function useRowsShelves(args: RowsShelvesArgs): RowsShelves {
  const { enabled, query, data, collections, history, showContinue } = args;
  const marks = useAppStore((state) => state.marks);
  const serial = useAppStore((state) => state.libraryRefreshSerial);
  const [loads, setLoads] = useState<ShelfLoads>(() => new Map());
  const [plan, setPlan] = useState<Plan | null>(null);
  const reader = useRef<RowsReader | null>(null);
  reader.current ??= new RowsReader(setLoads, SEAMS);
  const revealed = useRef<{ readonly key: string; readonly ids: readonly string[] } | null>(null);
  const positions = useRef(new Map<string, number>());

  const queryKey = libraryQueryKey(query);
  const removed = Object.values(history.removed).filter(Boolean).length;
  const names = collections.map((row) => `${row.id}:${row.name}`).join("|");
  const key = JSON.stringify([queryKey, serial, showContinue, names, removed]);
  const page = data.page;
  const regionsLoading = libraryRenderState([], page?.titlesAvailable ?? false, query.scope).titleRegionsLoading;
  const ready = !data.loading && page !== null && data.pageFor.queryKey === queryKey
    && data.pageFor.serial === serial && data.sideReady && !regionsLoading;
  const stale = plan !== null && (plan.key !== key || data.loading);
  const current = stale ? null : plan;

  useEffect(() => {
    if (stale) {
      reader.current?.cancel();
      revealed.current = null;
      positions.current.clear();
      setPlan(null);
      return;
    }
    if (plan !== null || !enabled || !ready || page === null) return;
    const specs = planShelves({ query, genreFacets: page.facets.genres, collections, showContinue });
    setPlan({ key, specs });
    reader.current?.start(specs);
  });
  useEffect(() => () => reader.current?.cancel(), []);

  /* The shown ids are fixed the first time every first page has answered, and kept for the plan. */
  const ids = current === null ? null : revealedShelves(current.specs, loads);
  if (current !== null && ids !== null && revealed.current?.key !== current.key) {
    revealed.current = { key: current.key, ids };
  }
  const shownIds = current !== null && revealed.current?.key === current.key ? revealed.current.ids : null;

  const shelves = useMemo((): RowsShelfView[] | null => {
    if (current === null || shownIds === null) return null;
    return shownIds.flatMap((id) => {
      const spec = current.specs.find((candidate) => candidate.id === id);
      const load = loads.get(id);
      if (spec === undefined || load === undefined) return [];
      return [{
        spec,
        items: resolveItems(load.items, marks, history, {}),
        count: shelfCount(load),
        hasMore: load.nextCursor !== undefined,
        paging: load.paging,
      }];
    });
  }, [current, shownIds, loads, marks, history]);

  const loadMore = useCallback((id: string): boolean => reader.current?.more(id) ?? false, []);
  return { shelves, loadMore, positions: positions.current };
}
