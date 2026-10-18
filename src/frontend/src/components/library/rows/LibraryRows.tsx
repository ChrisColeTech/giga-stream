import type { KeyboardEvent, ReactNode } from "react";
import { useScrollTopWhileLoading } from "@/hooks/useScrollTopWhileLoading";
import type { RowsShelfView } from "@/hooks/useRowsShelves";
import type { ResolvedItem } from "@/lib/library-marks";
import type { Scope } from "@/lib/library-query";
import type { ShelfGroup } from "@/lib/rows-shelves";
import type { CollectionRow } from "@/types/collection";
import { BackToTop } from "../BackToTop";
import { TypeStrip } from "../TypeStrip";
import { RowsShelf } from "./RowsShelf";
import { RowsSkeleton } from "./RowsSkeleton";
import { navigateShelves } from "./rows-navigation";
import { ROWS_COPY } from "./rows-constants";

export interface LibraryRowsProps {
  readonly scope: Scope;
  /** The shown shelves (`docs/33`), or null until every planned shelf's first page has answered: then only the
   *  skeleton shows. */
  readonly shelves: readonly RowsShelfView[] | null;
  /** Each shelf's remembered horizontal position, by shelf id. */
  readonly positions: Map<string, number>;
  readonly collections: readonly CollectionRow[];
  readonly selected: string | null;
  readonly onScope: (scope: Scope) => void;
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
  readonly onSeeAll: (group: ShelfGroup) => void;
  readonly onLoadMore: (id: string) => boolean;
  readonly onRefresh: () => void;
  readonly loading: boolean;
  /** Drawn under the type strip: the History strip while History is open, as the grid draws it. */
  readonly strip?: ReactNode;
}

/** The Rows view of Library (`06` section 4, Rows; `docs/33`): the type strip, then the shelves in their planned order.
 *  Each shelf is its own paged query; the view reveals once every shelf's first page has answered and no shelf moves
 *  after that. Until then, and when no shelf has anything, it draws skeletons. Up and Down move between shelves. */
export function LibraryRows({
  scope, shelves, positions, collections, selected, onScope, onSelect, onRemoveWatch, onSeeAll, onLoadMore, onRefresh,
  loading, strip,
}: LibraryRowsProps) {
  const scroller = useScrollTopWhileLoading<HTMLDivElement>(loading, "rows");
  const settled = shelves !== null && shelves.length > 0;
  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <TypeStrip scope={scope} onScope={onScope} onRefresh={onRefresh} refreshing={loading} />
      {strip}
      <div
        ref={scroller}
        role="group"
        aria-label={ROWS_COPY.listLabel}
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto py-3"
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => navigateShelves(event, onSelect)}
      >
        {!settled && <RowsSkeleton />}
        {(shelves ?? []).map((shelf) => (
          <RowsShelf
            key={shelf.spec.id}
            shelf={shelf}
            positions={positions}
            collections={collections}
            selected={selected}
            onSelect={onSelect}
            onRemoveWatch={onRemoveWatch}
            onSeeAll={onSeeAll}
            onLoadMore={onLoadMore}
          />
        ))}
      </div>
      <BackToTop scroller={scroller} />
    </div>
  );
}
