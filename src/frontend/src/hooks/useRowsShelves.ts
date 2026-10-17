import { useEffect, useRef } from "react";
import { libraryRenderState, shownItems } from "@/lib/library-render-state";
import { resolveItems, type HistoryMarks, type ResolvedItem } from "@/lib/library-marks";
import type { LibraryQuery } from "@/lib/library-query";
import { buildShelves, type Shelf } from "@/lib/rows-shelves";
import { nextRowsSnapshot, rowsWantsPage, settledItems, type RowsInput, type RowsSnapshot } from "@/lib/rows-settle";
import { libraryQueryKey } from "@/services/library";
import { useAppStore } from "@/store/app-store";
import type { CollectionRow } from "@/types/collection";
import type { LibraryItem } from "@/types/library";
import type { LibraryData } from "./useLibraryData";

export interface RowsShelvesArgs {
  /** The Rows view is the shown view of the shown surface. */
  readonly enabled: boolean;
  readonly query: LibraryQuery;
  readonly data: LibraryData;
  readonly collections: readonly CollectionRow[];
  readonly history: HistoryMarks;
  readonly showContinue: boolean;
}

/** The Rows view's finished shelves, or null while it shows its skeleton (`docs/33`). The shelves are built once from the
 *  bounded settled set and then kept, whatever later pages, side refreshes or marks bring, until a real invalidation
 *  (the key below, or a first-page read in flight) sends the view back through the skeleton. While the set is short of
 *  its bound, this asks the shared read for its next page, one at a time. */
export function useRowsShelves(args: RowsShelvesArgs): readonly Shelf[] | null {
  const { enabled, query, data, collections, history, showContinue } = args;
  const marks = useAppStore((state) => state.marks);
  const serial = useAppStore((state) => state.libraryRefreshSerial);
  const snapshot = useRef<RowsSnapshot | null>(null);
  const asked = useRef<string | undefined>(undefined);
  const queryKey = libraryQueryKey(query);
  const removed = Object.values(history.removed).filter(Boolean).length;
  const names = collections.map((row) => `${row.id}:${row.name}`).join("|");
  const page = data.page;
  const render = libraryRenderState([], page?.titlesAvailable ?? false, query.scope);
  const input: RowsInput = {
    key: JSON.stringify([queryKey, serial, showContinue, names, removed]),
    loading: data.loading,
    pageFresh: page !== null && data.pageFor.queryKey === queryKey && data.pageFor.serial === serial,
    sideReady: data.sideReady,
    regionsLoading: render.titleRegionsLoading,
    held: page?.items.length ?? 0,
    exhausted: page !== null && page.nextCursor === undefined,
  };
  const build = (): Shelf[] => {
    const items: readonly ResolvedItem[] = resolveItems(settledItems<LibraryItem>(page?.items ?? []), marks, history, {});
    const shown = shownItems(libraryRenderState(items, page?.titlesAvailable ?? false, query.scope).items, query.source);
    const continuing = resolveItems(data.continuing, marks, history, {});
    return buildShelves({ items: shown, continuing, collections, marks, showContinue });
  };
  snapshot.current = enabled ? nextRowsSnapshot(snapshot.current, input, build) : snapshot.current;

  /* One page per cursor: a failed read says its sentence once and is not asked again until the next invalidation. */
  const cursor = page?.nextCursor;
  useEffect(() => {
    if (!enabled || !rowsWantsPage(input, true, data.paging) || asked.current === cursor) return;
    asked.current = cursor;
    data.loadMore();
  });
  useEffect(() => { asked.current = undefined; }, [queryKey, serial]);
  return enabled ? snapshot.current?.shelves ?? null : null;
}
