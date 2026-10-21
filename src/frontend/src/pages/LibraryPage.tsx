import { useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceSplit } from "@/components/chrome/WorkspaceSplit";
import { HistoryStrip } from "@/components/library/HistoryStrip";
import { LibraryBody } from "@/components/library/LibraryBody";
import { LibraryFilters } from "@/components/library/LibraryFilters";
import { LibraryRail } from "@/components/library/LibraryRail";
import { LibraryToolbar } from "@/components/library/LibraryToolbar";
import type { Reveal } from "@/components/library/WindowedRows";
import { LibraryRows } from "@/components/library/rows/LibraryRows";
import { TitleSpotlight } from "@/components/library/TitleSpotlight";
import { useTitleSpotlight } from "@/hooks/useTitleSpotlight";
import { useLibraryActions } from "@/hooks/useLibraryActions";
import { useLibraryData } from "@/hooks/useLibraryData";
import { useGenreOptions } from "@/hooks/useGenreOptions";
import { useRowsShelves } from "@/hooks/useRowsShelves";
import { useLibraryRequest } from "@/hooks/useLibraryRequest";
import { useSavedLibraryQuery } from "@/hooks/useSavedLibraryQuery";
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
import { groupQuery, type ShelfGroup } from "@/lib/rows-shelves";
import { libraryRenderState, shownItems } from "@/lib/library-render-state";
import { useAppStore } from "@/store/app-store";

export function LibraryPage({ active }: { active: boolean }) {
  const actions = useLibraryActions();
  const prefs = useAppStore((state) => state.library);
  const marks = useAppStore((state) => state.marks);
  const signedIn = useAppStore((state) => state.signedIn);
  const collections = useAppStore((state) => state.collections).map(collectionRow);
  const counts = useAppStore((state) => state.libraryCounts);
  const { query, view, ready, patch, setView, changeView } = useSavedLibraryQuery();
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryMarks>(NO_HISTORY);
  const data = useLibraryData(active, query, prefs.showContinue, ready);
  const items = useMemo(() => resolveItems(data.page?.items ?? [], marks, history, {}), [data.page, marks, history]);
  const continuing = useMemo(
    () => resolveItems(data.continuing, marks, history, {}),
    [data.continuing, marks, history],
  );
  const render = libraryRenderState(items, data.page?.titlesAvailable ?? false, query.scope);
  const shown = shownItems(render.items, query.source);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const onRevealed = useCallback(() => setReveal(null), []);
  /* Rows has no windowed list to take the request, and a stale one must not scroll a grid shown later. */
  useEffect(() => { if (view === "rows") setReveal(null); }, [view, reveal]);
  useLibraryRequest({ patch, setView, setSelected, setReveal });
  const spotlight = useTitleSpotlight(active);
  const onSeeAll = useCallback((group: ShelfGroup): void => {
    patch(groupQuery(group));
    setView("grid");
  }, [patch]);

  const onRemoveWatch = useCallback((item: ResolvedItem): void => {
    if (item.watchId === undefined) return;
    const watchId = item.watchId;
    void actions.removeWatch(
      watchId,
      () => setHistory((current) => withRemoved(current, watchId)),
      () => setHistory((current) => withRestored(current, watchId)),
    );
  }, [actions]);
  const onClearHistory = useCallback((): void => {
    let previous = NO_HISTORY;
    void actions.clearHistory(
      () => setHistory((current) => {
        previous = current;
        return withCleared(items.flatMap((item) => item.watchId === undefined ? [] : [item.watchId]));
      }),
      () => setHistory(previous),
    );
  }, [actions, items]);
  const rows = view === "rows";
  const genres = useGenreOptions(data.page?.facets.genres ?? null, query.genres);
  const years = [...new Set([
    ...(data.page?.facets.years ?? []), ...(query.year === "" ? [] : [Number(query.year)]),
  ])].sort((a, b) => b - a);
  const filters = (
    <LibraryFilters query={query} genres={genres} years={years} trending={data.page?.trending ?? false} onQuery={patch} />
  );
  const toolbar = (
    <LibraryToolbar
      query={query} view={view} loading={data.loading}
      onQuery={patch} onView={changeView} onRefresh={data.refresh} onSearch={spotlight.open}
    />
  );
  const rowsShelves = useRowsShelves({
    enabled: rows && active, query, data, collections, history,
    showContinue: prefs.showContinue && signedIn && query.source !== "history",
  });
  const center = rows ? (
    <LibraryRows
      toolbar={toolbar} shelves={rowsShelves.shelves} positions={rowsShelves.positions} collections={collections}
      selected={selected} onSelect={setSelected} onRemoveWatch={onRemoveWatch} onSeeAll={onSeeAll}
      onLoadMore={rowsShelves.loadMore} loading={data.loading}
      strip={query.source === "history" && <HistoryStrip empty={shown.length === 0} onClear={onClearHistory} />}
    />
  ) : (
    <LibraryBody
      scope={query.scope} source={query.source} signedIn={signedIn} showContinue={prefs.showContinue}
      view={view} items={items}
      shown={shown} continuing={continuing} collections={collections} selected={selected} toolbar={toolbar}
      onSelect={setSelected} onRemoveWatch={onRemoveWatch} onClearHistory={onClearHistory}
      loading={data.loading}
      paging={data.paging} hasMore={data.hasMore} onLoadMore={data.loadMore}
      titleRegionsLoading={render.titleRegionsLoading} reveal={reveal} onRevealed={onRevealed}
    />
  );

  return (
    <>
      <WorkspaceSplit
        surface="library" active={active}
        left={
          <LibraryRail
            query={query} signedIn={signedIn} counts={counts} collections={collections} genres={genres} onQuery={patch}
          />
        }
        center={center}
        right={filters}
      />
      {spotlight.state.open && (
        <TitleSpotlight
          state={spotlight.state} dispatch={spotlight.dispatch} paused={spotlight.paused} onClose={spotlight.close}
          onType={spotlight.type} onSubmit={spotlight.submit} onPlay={spotlight.play} onInfo={spotlight.info}
        />
      )}
    </>
  );
}
