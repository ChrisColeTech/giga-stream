import type { Shelf, ShelfGroup } from "@/lib/rows-shelves";
import type { ResolvedItem } from "@/lib/library-marks";
import type { CollectionRow } from "@/types/collection";
import { ShelfHeading } from "./ShelfHeading";
import { ShelfRow } from "./ShelfRow";

export interface RowsShelfProps {
  readonly shelf: Shelf;
  readonly collections: readonly CollectionRow[];
  readonly selected: string | null;
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
  readonly onSeeAll: (group: ShelfGroup) => void;
}

/** The frame of one shelf: its heading, then its row. The shelf is a labelled region. */
export function RowsShelf({ shelf, collections, selected, onSelect, onRemoveWatch, onSeeAll }: RowsShelfProps) {
  return (
    <section data-shelf aria-label={shelf.name} className="flex min-w-0 flex-col gap-2.5">
      <ShelfHeading name={shelf.name} count={shelf.items.length} onSeeAll={() => onSeeAll(shelf.group)} />
      <ShelfRow
        name={shelf.name}
        items={shelf.items}
        continuing={shelf.group.kind === "continue"}
        selected={selected}
        collections={collections}
        onSelect={onSelect}
        onRemoveWatch={onRemoveWatch}
      />
    </section>
  );
}
