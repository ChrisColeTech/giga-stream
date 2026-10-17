import { type ListView, type Scope, type SourceId } from "@/lib/library-query";
import type { ResolvedItem } from "@/lib/library-marks";
import type { CollectionRow } from "@/types/collection";
import { ContinueStrip } from "./ContinueStrip";
import { HistoryStrip } from "./HistoryStrip";
import { PosterGrid } from "./PosterGrid";
import { PosterList } from "./PosterList";
import { TypeStrip } from "./TypeStrip";
import { LibraryPager } from "./LibraryPager";
import { PosterGridSkeleton } from "./PosterGridSkeleton";
import { SkeletonRows } from "@giga/ui/lists/SkeletonRows";
import { SKELETON_CARDS, SKELETON_ROWS } from "@/lib/library-limits";

export interface LibraryBodyProps {
  readonly scope: Scope;
  /** The rail's view: History draws its strip, and Continue watching narrows to the same source. */
  readonly source: SourceId;
  /** The Continue watching setting. */
  readonly showContinue: boolean;
  /** The grid or the list; the Rows view is drawn by the page instead. */
  readonly view: Exclude<ListView, "rows">;
  /** Every item with its marks applied: the source of Continue Watching and of the History's emptiness. */
  readonly items: readonly ResolvedItem[];
  /** The items the query shows, in order. */
  readonly shown: readonly ResolvedItem[];
  readonly continuing: readonly ResolvedItem[];
  readonly collections: readonly CollectionRow[];
  readonly selected: string | null;
  readonly onScope: (scope: Scope) => void;
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
  readonly onClearHistory: () => void;
  readonly onRefresh: () => void;
  readonly loading: boolean;
  readonly paging: boolean;
  readonly hasMore: boolean;
  readonly onLoadMore: () => boolean;
  readonly titleRegionsLoading: boolean;
}

/** The centre of Library: the type strip, the History strip when History is open, then Continue Watching and the
 *  results as a grid or a list. */
export function LibraryBody({
  scope,
  source,
  showContinue,
  view,
  items,
  shown,
  continuing,
  collections,
  selected,
  onScope,
  onSelect,
  onRemoveWatch,
  onClearHistory,
  onRefresh,
  loading,
  paging,
  hasMore,
  onLoadMore,
  titleRegionsLoading,
}: LibraryBodyProps) {
  const inHistory = source === "history";
  const continueRows = inHistory || !showContinue ? [] : continuing;
  const historyEmpty = !items.some((item) => item.progress !== undefined);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TypeStrip scope={scope} onScope={onScope} onRefresh={onRefresh} refreshing={loading} />
      {inHistory && <HistoryStrip empty={historyEmpty} onClear={onClearHistory} />}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <ContinueStrip
          items={continueRows}
          selected={selected}
          collections={collections}
          onSelect={onSelect}
          onRemoveWatch={onRemoveWatch}
        />
        {view === "grid" ? (
          <PosterGrid
            items={shown}
            selected={selected}
            inHistory={inHistory}
            collections={collections}
            onSelect={onSelect}
            onRemoveWatch={onRemoveWatch}
          />
        ) : (
          <PosterList
            items={shown}
            selected={selected}
            inHistory={inHistory}
            collections={collections}
            onSelect={onSelect}
            onRemoveWatch={onRemoveWatch}
          />
        )}
        {titleRegionsLoading && shown.length > 0 && (
          view === "grid" ? <PosterGridSkeleton count={SKELETON_CARDS} /> : <SkeletonRows count={SKELETON_ROWS} />
        )}
        <LibraryPager hasMore={hasMore} loading={paging} view={view} onVisible={onLoadMore} />
      </div>
    </div>
  );
}
