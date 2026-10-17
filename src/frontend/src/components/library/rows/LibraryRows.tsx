import type { KeyboardEvent, ReactNode } from "react";
import { useScrollTopWhileLoading } from "@/hooks/useScrollTopWhileLoading";
import type { ResolvedItem } from "@/lib/library-marks";
import type { Scope } from "@/lib/library-query";
import type { Shelf, ShelfGroup } from "@/lib/rows-shelves";
import type { CollectionRow } from "@/types/collection";
import { BackToTop } from "../BackToTop";
import { TypeStrip } from "../TypeStrip";
import { RowsShelf } from "./RowsShelf";
import { RowsSkeleton } from "./RowsSkeleton";
import { navigateRows } from "./rows-navigation";
import { ROWS_COPY } from "./rows-constants";

export interface LibraryRowsProps {
  readonly scope: Scope;
  /** The finished shelves (`docs/33`), or null while the grouping is not settled: then only the skeleton shows. */
  readonly shelves: readonly Shelf[] | null;
  readonly collections: readonly CollectionRow[];
  readonly selected: string | null;
  readonly onScope: (scope: Scope) => void;
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
  readonly onSeeAll: (group: ShelfGroup) => void;
  readonly onRefresh: () => void;
  readonly loading: boolean;
  /** Drawn under the type strip: the History strip while History is open, as the grid draws it. */
  readonly strip?: ReactNode;
}

/** The Rows view of Library (`06` section 4, Rows): the type strip, then the shelves in their order, each only when it
 *  has items. The shelves are grouped once from a bounded, settled set and never move after they appear (`docs/33`);
 *  until then, and when there is nothing to group, it draws skeletons. Arrow keys move across the cards, and up and
 *  down between shelves. */
export function LibraryRows({
  scope,
  shelves,
  collections,
  selected,
  onScope,
  onSelect,
  onRemoveWatch,
  onSeeAll,
  onRefresh,
  loading,
  strip,
}: LibraryRowsProps) {
  const scroller = useScrollTopWhileLoading<HTMLDivElement>(loading);
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
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => navigateRows(event, onSelect)}
      >
        {!settled && <RowsSkeleton />}
        {(shelves ?? []).map((shelf) => (
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
      </div>
      <BackToTop scroller={scroller} />
    </div>
  );
}
