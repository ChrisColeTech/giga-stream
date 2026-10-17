import type { RefObject } from "react";
import { SkeletonRows } from "@giga/ui/lists/SkeletonRows";
import { LIST_SPEC } from "@/constants/library-window";
import type { Measured } from "@/hooks/useWindowedRows";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { SKELETON_ROWS } from "@/lib/library-limits";
import type { ResolvedItem } from "@/lib/library-marks";
import type { CollectionRow } from "@/types/collection";
import { PosterListRow } from "./PosterListRow";
import { WindowedRows, type Reveal } from "./WindowedRows";

export interface PosterListProps {
  readonly items: readonly ResolvedItem[];
  readonly selected: string | null;
  readonly inHistory: boolean;
  readonly collections: readonly CollectionRow[];
  /** The Library's scroller: the list mounts only the rows near its viewport. */
  readonly scroller: RefObject<HTMLElement | null>;
  readonly reveal?: Reveal | null;
  readonly onRevealed?: () => void;
  readonly measured?: Measured;
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
}

/** The list view: one row per title, in the same order as the grid, windowed like it (`docs/32` section 2.7). Loading
 *  and settled empty use row skeletons. */
export function PosterList({
  items, selected, inHistory, collections, scroller, reveal, onRevealed, measured, onSelect, onRemoveWatch,
}: PosterListProps) {
  if (items.length === 0) return <SkeletonRows count={SKELETON_ROWS} />;
  return (
    <WindowedRows
      count={items.length}
      spec={LIST_SPEC}
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
          <PosterListRow
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
