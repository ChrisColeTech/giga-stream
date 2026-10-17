import { SkeletonCards } from "@/components/ui/SkeletonCards";
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
  readonly loading: boolean;
}

/* Cards at least 144 px wide, so six to eight across at 1600 px of body width (`06` section 4.2). */
const GRID = "grid grid-cols-[repeat(auto-fill,minmax(144px,1fr))] gap-3 p-3";

/** The poster grid. A pending empty request draws card skeletons; a settled empty query keeps the grid empty. */
export function PosterGrid({ items, selected, inHistory, collections, onSelect, onRemoveWatch, loading }: PosterGridProps) {
  if (items.length === 0 && loading) return <SkeletonCards count={SKELETON_CARDS} />;
  const ids = items.map((item) => item.ref.id);
  return (
    <div
      role="group"
      aria-label={LIBRARY_COPY.listLabel}
      className={GRID}
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
