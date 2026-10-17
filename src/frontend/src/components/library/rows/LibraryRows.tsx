import { useMemo, type KeyboardEvent } from "react";
import { useAppStore } from "@/store/app-store";
import type { ResolvedItem } from "@/lib/library-marks";
import { buildShelves, type ShelfGroup } from "@/lib/rows-shelves";
import type { CollectionRow } from "@/types/collection";
import { RowsShelf } from "./RowsShelf";
import { RowsSkeleton } from "./RowsSkeleton";
import { navigateRows } from "./rows-navigation";
import { ROWS_COPY } from "./rows-constants";

export interface LibraryRowsProps {
  /** Every item with the Library's marks applied; the Rows view is the whole library, grouped. */
  readonly items: readonly ResolvedItem[];
  readonly collections: readonly CollectionRow[];
  readonly selected: string | null;
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
  readonly onSeeAll: (group: ShelfGroup) => void;
}

/** The Rows view of Library (`06` section 4, Rows): the shelves in their order, each only when it has items. Arrow keys
 *  move across the cards, and up and down between shelves. With nothing to show it draws skeletons. */
export function LibraryRows({ items, collections, selected, onSelect, onRemoveWatch, onSeeAll }: LibraryRowsProps) {
  const marks = useAppStore((state) => state.marks);
  const shelves = useMemo(() => buildShelves({ items, collections, marks }), [items, collections, marks]);
  if (shelves.length === 0) return <RowsSkeleton />;
  return (
    <div
      role="group"
      aria-label={ROWS_COPY.listLabel}
      className="flex h-full min-h-0 min-w-0 flex-col gap-6 overflow-y-auto py-3"
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
    </div>
  );
}
