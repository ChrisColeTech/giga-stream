import type { RefObject } from "react";
import { PosterGridSkeleton } from "./PosterGridSkeleton";
import { GRID_SPEC } from "@/constants/library-window";
import type { Measured } from "@/hooks/useWindowedRows";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { SKELETON_CARDS } from "@/lib/library-limits";
import type { ResolvedItem } from "@/lib/library-marks";
import type { CollectionRow } from "@/types/collection";
import { PosterCard } from "./PosterCard";
import { WindowedRows, type Reveal } from "./WindowedRows";

export interface PosterGridProps {
  readonly items: readonly ResolvedItem[];
  readonly selected: string | null;
  readonly inHistory: boolean;
  readonly collections: readonly CollectionRow[];
  /** The Library's scroller: the grid mounts only the rows near its viewport. */
  readonly scroller: RefObject<HTMLElement | null>;
  readonly reveal?: Reveal | null;
  readonly onRevealed?: () => void;
  readonly measured?: Measured;
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
}

/** The poster grid, windowed (`docs/32`): thousands of titles keep a few dozen cards in the page. Loading and settled
 *  empty queries draw card skeletons. */
export function PosterGrid({
  items, selected, inHistory, collections, scroller, reveal, onRevealed, measured, onSelect, onRemoveWatch,
}: PosterGridProps) {
  if (items.length === 0) return <PosterGridSkeleton count={SKELETON_CARDS} />;
  return (
    <WindowedRows
      count={items.length}
      spec={GRID_SPEC}
      scroller={scroller}
      label={LIBRARY_COPY.listLabel}
      idAt={(index) => items[index]?.ref.id}
      onSelect={onSelect}
      reveal={reveal}
      onRevealed={onRevealed}
      measured={measured}
      renderCell={(index) => {
        const item = items[index];
        return item === undefined ? null : (
          <PosterCard
            key={`${item.ref.kind}:${item.ref.id}`}
            item={item}
            index={index}
            selected={selected === item.ref.id}
            inHistory={inHistory}
            collections={collections}
            onSelect={onSelect}
            onRemoveWatch={onRemoveWatch}
          />
        );
      }}
    />
  );
}
