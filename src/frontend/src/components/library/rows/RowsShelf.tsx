import type { RowsShelfView } from "@/hooks/useRowsShelves";
import type { ShelfGroup } from "@/lib/rows-shelves";
import type { ResolvedItem } from "@/lib/library-marks";
import type { CollectionRow } from "@/types/collection";
import { ShelfHeading } from "./ShelfHeading";
import { ShelfRow } from "./ShelfRow";

export interface RowsShelfProps {
  readonly shelf: RowsShelfView;
  readonly positions: Map<string, number>;
  readonly collections: readonly CollectionRow[];
  readonly selected: string | null;
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
  readonly onSeeAll: (group: ShelfGroup) => void;
  readonly onLoadMore: (id: string) => boolean;
}

/** The frame of one shelf: its heading, then its row. The shelf is a labelled region. */
export function RowsShelf({
  shelf, positions, collections, selected, onSelect, onRemoveWatch, onSeeAll, onLoadMore,
}: RowsShelfProps) {
  const { spec } = shelf;
  return (
    <section data-shelf aria-label={spec.name} className="flex min-w-0 flex-col gap-2.5">
      <ShelfHeading name={spec.name} count={shelf.count} onSeeAll={() => onSeeAll(spec.group)} />
      <ShelfRow
        id={spec.id}
        name={spec.name}
        items={shelf.items}
        continuing={spec.group.kind === "continue"}
        hasMore={shelf.hasMore}
        paging={shelf.paging}
        positions={positions}
        selected={selected}
        collections={collections}
        onSelect={onSelect}
        onRemoveWatch={onRemoveWatch}
        onLoadMore={() => onLoadMore(spec.id)}
      />
    </section>
  );
}
