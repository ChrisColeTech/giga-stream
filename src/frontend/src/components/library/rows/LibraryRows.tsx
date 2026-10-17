import { useMemo, type KeyboardEvent, type ReactNode } from "react";
import { useAppStore } from "@/store/app-store";
import type { ResolvedItem } from "@/lib/library-marks";
import type { Scope } from "@/lib/library-query";
import { buildShelves, type ShelfGroup } from "@/lib/rows-shelves";
import type { CollectionRow } from "@/types/collection";
import { TypeStrip } from "../TypeStrip";
import { LibraryPager } from "../LibraryPager";
import { RowsShelf } from "./RowsShelf";
import { RowsSkeleton } from "./RowsSkeleton";
import { navigateRows } from "./rows-navigation";
import { ROWS_COPY } from "./rows-constants";

export interface LibraryRowsProps {
  readonly scope: Scope;
  /** The items the query shows (the rail's view, the type, the search and the filters), grouped into shelves. */
  readonly items: readonly ResolvedItem[];
  readonly continuing: readonly ResolvedItem[];
  readonly collections: readonly CollectionRow[];
  readonly selected: string | null;
  /** The Continue watching setting; off (or in History), that shelf is not drawn. */
  readonly showContinue: boolean;
  readonly onScope: (scope: Scope) => void;
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
  readonly onSeeAll: (group: ShelfGroup) => void;
  readonly onRefresh: () => void;
  readonly loading: boolean;
  readonly paging: boolean;
  readonly hasMore: boolean;
  readonly onLoadMore: () => void;
  readonly titleRegionsLoading: boolean;
  /** Drawn under the type strip: the History strip while History is open, as the grid draws it. */
  readonly strip?: ReactNode;
}

/** The Rows view of Library (`06` section 4, Rows): the type strip, then the shelves in their order, each only when it
 *  has items. Rows groups what the grid would show, so the rail, the strip and the filters narrow it the same way. Arrow
 *  keys move across the cards, and up and down between shelves. With nothing to show it draws skeletons. */
export function LibraryRows({
  scope,
  items,
  continuing,
  collections,
  selected,
  showContinue,
  onScope,
  onSelect,
  onRemoveWatch,
  onSeeAll,
  onRefresh,
  loading,
  paging,
  hasMore,
  onLoadMore,
  titleRegionsLoading,
  strip,
}: LibraryRowsProps) {
  const marks = useAppStore((state) => state.marks);
  const shelves = useMemo(
    () => buildShelves({ items, continuing, collections, marks, showContinue }),
    [items, continuing, collections, marks, showContinue],
  );
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <TypeStrip scope={scope} onScope={onScope} onRefresh={onRefresh} refreshing={loading} />
      {strip}
      {shelves.length === 0 ? (
        <RowsSkeleton />
      ) : (
        <div
          role="group"
          aria-label={ROWS_COPY.listLabel}
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto py-3"
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => navigateRows(event, onSelect)}
        >
          {shelves.map((shelf) => (
            <RowsShelf
              key={shelf.id}
              shelf={shelf}
              collections={collections}
              selected={selected}
              onSelect={onSelect}
              onRemoveWatch={onRemoveWatch}
              onSeeAll={onSeeAll}
            />
          ))}
          {titleRegionsLoading && shelves.length > 0 && <RowsSkeleton />}
          <LibraryPager hasMore={hasMore} loading={paging} view="rows" onVisible={onLoadMore} />
        </div>
      )}
    </div>
  );
}
