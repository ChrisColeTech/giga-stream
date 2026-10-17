import { POSTER_GRID, PosterGridSkeleton } from "./PosterGridSkeleton";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { SKELETON_CARDS } from "@/lib/library-limits";
import type { ResolvedItem } from "@/lib/library-marks";
import type { CollectionRow } from "@/types/collection";
import { navigateCards } from "./card-keys";
import { PosterCard } from "./PosterCard";

export interface PosterGridProps {
  readonly items: readonly ResolvedItem[];
  readonly selected: string | null;
  readonly inHistory: boolean;
  readonly collections: readonly CollectionRow[];
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
}

/** The poster grid. Loading and settled empty queries draw card skeletons. */
export function PosterGrid({ items, selected, inHistory, collections, onSelect, onRemoveWatch }: PosterGridProps) {
  if (items.length === 0) return <PosterGridSkeleton count={SKELETON_CARDS} />;
  const ids = items.map((item) => item.ref.id);
  return (
    <div
      role="group"
      aria-label={LIBRARY_COPY.listLabel}
      className={POSTER_GRID}
      onKeyDown={(event) => navigateCards(event, ids, onSelect)}
    >
      {items.map((item) => (
        <PosterCard
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
