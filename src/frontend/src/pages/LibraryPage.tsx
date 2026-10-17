import { useCallback, useMemo, useState } from "react";
import { WorkspaceSplit } from "@/components/chrome/WorkspaceSplit";
import { HistoryStrip } from "@/components/library/HistoryStrip";
import { LibraryBody } from "@/components/library/LibraryBody";
import { LibraryFilters } from "@/components/library/LibraryFilters";
import { LibraryRail } from "@/components/library/LibraryRail";
import { LibraryRows } from "@/components/library/rows/LibraryRows";
import { clearWatchHistory, removeWatchEntry } from "@/components/library/library-service";
import { useLibraryData } from "@/hooks/useLibraryData";
import { useLibraryRequest } from "@/hooks/useLibraryRequest";
import { collectionRow } from "@/lib/collections-model";
import {
  NO_HISTORY,
  resolveItems,
  withCleared,
  withRemoved,
  withRestored,
  type HistoryMarks,
  type ResolvedItem,
} from "@/lib/library-marks";
import {
  DEFAULT_QUERY,
  type LibraryQuery,
  type ListView,
  type Scope,
  type SourceId,
} from "@/lib/library-query";
import { groupQuery, type ShelfGroup } from "@/lib/rows-shelves";
import { libraryRenderState } from "@/lib/library-render-state";
import { useAppStore } from "@/store/app-store";

export function LibraryPage({ active }: { active: boolean }) {
  const prefs = useAppStore((state) => state.library);
  const marks = useAppStore((state) => state.marks);
  const collections = useAppStore((state) => state.collections).map(collectionRow);
  const counts = useAppStore((state) => state.libraryCounts);
  const [query, setQuery] = useState<LibraryQuery>(() => ({ ...DEFAULT_QUERY, sort: prefs.librarySort }));
  const [view, setView] = useState<ListView>(prefs.libraryView);
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryMarks>(NO_HISTORY);
  const data = useLibraryData(active, query, prefs.showContinue);
  const items = useMemo(() => resolveItems(data.page?.items ?? [], marks, history, {}), [data.page, marks, history]);
  const continuing = useMemo(
    () => resolveItems(data.continuing, marks, history, {}),
    [data.continuing, marks, history],
  );
  const render = libraryRenderState(items, data.page?.titlesAvailable ?? false, query.scope, data.loading);
  const shown = query.source === "history"
    ? render.items.filter((item) => item.progress !== undefined)
    : query.source === "favorites" ? render.items.filter((item) => item.favorite) : render.items;
  const patch = useCallback((change: Partial<LibraryQuery>) => setQuery((current) => ({ ...current, ...change })), []);
  useLibraryRequest({ patch, setView, setSelected });
  const onSource = (source: SourceId): void => patch({ source });
  const onScope = (scope: Scope): void => patch({ scope });
  const onSeeAll = useCallback((group: ShelfGroup): void => {
    patch(groupQuery(group));
    setView("grid");
  }, [patch]);

  const onRemoveWatch = useCallback((item: ResolvedItem): void => {
    if (item.watchId === undefined) return;
    const watchId = item.watchId;
    void removeWatchEntry(
      watchId,
      () => setHistory((current) => withRemoved(current, watchId)),
      () => setHistory((current) => withRestored(current, watchId)),
    );
  }, []);
  const onClearHistory = useCallback((): void => {
    let previous = NO_HISTORY;
    void clearWatchHistory(
      () => setHistory((current) => {
        previous = current;
        return withCleared(items.flatMap((item) => item.watchId === undefined ? [] : [item.watchId]));
      }),
      () => setHistory(previous),
    );
  }, [items]);
  const rows = view === "rows";
  const center = rows ? (
    <LibraryRows
      scope={query.scope} items={shown} continuing={continuing} collections={collections} selected={selected}
      showContinue={prefs.showContinue && query.source !== "history"} onScope={onScope} onSelect={setSelected}
      onRemoveWatch={onRemoveWatch} onSeeAll={onSeeAll} onRefresh={data.refresh} loading={data.loading}
      paging={data.paging} hasMore={data.hasMore} onLoadMore={data.loadMore}
      titleRegionsLoading={render.titleRegionsLoading}
      strip={query.source === "history" && <HistoryStrip empty={shown.length === 0} onClear={onClearHistory} />}
    />
  ) : (
    <LibraryBody
      scope={query.scope} source={query.source} showContinue={prefs.showContinue} view={view} items={items}
      shown={shown} continuing={continuing} collections={collections} selected={selected} onScope={onScope}
      onSelect={setSelected} onRemoveWatch={onRemoveWatch} onClearHistory={onClearHistory}
      onRefresh={data.refresh} loading={data.loading}
      paging={data.paging} hasMore={data.hasMore} onLoadMore={data.loadMore}
      titleRegionsLoading={render.titleRegionsLoading}
    />
  );

  return (
    <WorkspaceSplit
      surface="library" active={active}
      left={<LibraryRail source={query.source} counts={counts} collections={collections} onSource={onSource} />}
      center={center}
      right={<LibraryFilters query={query} view={view}
        genres={[...new Set([...(data.page?.facets.genres ?? []), ...query.genres])]} years={[
          ...new Set([...(data.page?.facets.years ?? []), ...(query.year === "" ? [] : [Number(query.year)])]),
        ].sort((a, b) => b - a)} trending={data.page?.trending ?? false} onQuery={patch} onView={setView} />}
    />
  );
}
