import { SkeletonRows } from "@/components/ui/SkeletonRows";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { SKELETON_ROWS } from "@/lib/library-limits";
import type { ResolvedItem } from "@/lib/library-marks";
import type { CollectionRow } from "@/types/collection";
import { navigateCards } from "./card-keys";
import { PosterListRow } from "./PosterListRow";

export interface PosterListProps {
  readonly items: readonly ResolvedItem[];
  readonly selected: string | null;
  readonly inHistory: boolean;
  readonly collections: readonly CollectionRow[];
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
  readonly loading: boolean;
}

/** The list view: one row per title, in the same order as the grid. Only a pending empty request draws skeletons. */
export function PosterList({ items, selected, inHistory, collections, onSelect, onRemoveWatch, loading }: PosterListProps) {
  if (items.length === 0 && loading) return <SkeletonRows count={SKELETON_ROWS} />;
  const ids = items.map((item) => item.ref.id);
  return (
    <div
      role="group"
      aria-label={LIBRARY_COPY.listLabel}
      className="flex flex-col gap-1 p-2"
      onKeyDown={(event) => navigateCards(event, ids, onSelect)}
    >
      {items.map((item) => (
        <PosterListRow
          key={`${item.ref.kind}:${item.ref.id}`}
          item={item}
          selected={selected === item.ref.id}
          inHistory={inHistory}
          collections={collections}
          onSelect={onSelect}
          onRemoveWatch={onRemoveWatch}
        />
      ))}
    </div>
  );
}
