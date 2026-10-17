import { useCallback, useMemo, useState } from "react";
import { WorkspaceSplit } from "@/components/chrome/WorkspaceSplit";
import { HistoryStrip } from "@/components/library/HistoryStrip";
import { LibraryBody } from "@/components/library/LibraryBody";
import { LibraryFilters } from "@/components/library/LibraryFilters";
import { LibraryRail } from "@/components/library/LibraryRail";
import { LibraryRows } from "@/components/library/rows/LibraryRows";
import { clearWatchHistory, removeWatchEntry } from "@/components/library/library-service";
import { COLLECTION_ROWS, MEMBERSHIP } from "@/fixtures/collections";
import { LIBRARY_ITEMS } from "@/fixtures/titles";
import {
  NO_HISTORY,
  itemKey,
  resolveItems,
  withCleared,
  withRemoved,
  type HistoryMarks,
  type ResolvedItem,
} from "@/lib/library-marks";
import {
  DEFAULT_QUERY,
  genreChoices,
  viewCounts,
  visibleItems,
  yearChoices,
  type LibraryQuery,
  type ListView,
  type Scope,
  type SourceId,
} from "@/lib/library-query";
import { groupQuery, type ShelfGroup } from "@/lib/rows-shelves";
import { useLibraryRequest } from "@/hooks/useLibraryRequest";
import { useAppStore } from "@/store/app-store";

const GENRES = genreChoices(LIBRARY_ITEMS);
const YEARS = yearChoices(LIBRARY_ITEMS);

/** Library: collections on the left, the media body in the centre, filters on the right. The query, the view, the
 *  selection and the watch-history marks are local to the surface; favourites and memberships come from the store. */
export function LibraryPage({ active }: { active: boolean }) {
  const prefs = useAppStore((state) => state.library);
  const [query, setQuery] = useState<LibraryQuery>(() => ({ ...DEFAULT_QUERY, sort: prefs.librarySort }));
  const [view, setView] = useState<ListView>(prefs.libraryView);
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryMarks>(NO_HISTORY);
  const marks = useAppStore((state) => state.marks);
  const items = useMemo(() => resolveItems(LIBRARY_ITEMS, marks, history, MEMBERSHIP), [marks, history]);
  const shown = useMemo(() => visibleItems(items, query), [items, query]);
  const counts = useMemo(() => viewCounts(items, COLLECTION_ROWS), [items]);
  const patch = useCallback((change: Partial<LibraryQuery>) => setQuery((current) => ({ ...current, ...change })), []);
  useLibraryRequest({ patch, setView, setSelected });
  const onSource = (source: SourceId): void => patch({ source });
  const onScope = (scope: Scope): void => patch({ scope });
  /* See all opens the grid with the shelf's group, through the same query setter the rail and the type strip use. */
  const onSeeAll = useCallback(
    (group: ShelfGroup): void => {
      patch(groupQuery(group));
      setView("grid");
    },
    [patch],
  );

  /* A watch entry or the whole History changes only when the fileserver accepts the call. */
  const onRemoveWatch = useCallback((item: ResolvedItem): void => {
    if (item.watchId === undefined || !removeWatchEntry(item.watchId)) return;
    const key = itemKey(item.ref);
    setHistory((current) => withRemoved(current, key));
  }, []);
  const onClearHistory = useCallback((): void => {
    if (clearWatchHistory()) setHistory(withCleared());
  }, []);

  return (
    <WorkspaceSplit
      surface="library"
      active={active}
      left={<LibraryRail source={query.source} counts={counts} collections={COLLECTION_ROWS} onSource={onSource} />}
      center={
        view === "rows" ? (
          <LibraryRows
            scope={query.scope}
            items={shown}
            collections={COLLECTION_ROWS}
            selected={selected}
            showContinue={prefs.showContinue && query.source !== "history"}
            onScope={onScope}
            onSelect={setSelected}
            onRemoveWatch={onRemoveWatch}
            onSeeAll={onSeeAll}
            strip={
              query.source === "history" && (
                <HistoryStrip empty={!items.some((item) => item.progress !== undefined)} onClear={onClearHistory} />
              )
            }
          />
        ) : (
          <LibraryBody
            scope={query.scope}
            source={query.source}
            showContinue={prefs.showContinue}
            view={view}
            items={items}
            shown={shown}
            collections={COLLECTION_ROWS}
            selected={selected}
            onScope={onScope}
            onSelect={setSelected}
            onRemoveWatch={onRemoveWatch}
            onClearHistory={onClearHistory}
          />
        )
      }
      right={
        <LibraryFilters
          query={query}
          view={view}
          genres={GENRES}
          years={YEARS}
          onQuery={patch}
          onView={setView}
        />
      }
    />
  );
}
