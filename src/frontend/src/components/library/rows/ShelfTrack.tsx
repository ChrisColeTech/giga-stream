import type { Ref } from "react";
import { SHIMMER, SHIMMER_TILE as FILL } from "@giga/ui/lib/shimmer";
import { cn } from "@giga/ui/lib/cn";
import type { ResolvedItem } from "@/lib/library-marks";
import type { ShelfSegment } from "@/lib/shelf-window";
import type { CollectionRow } from "@/types/collection";
import { ContinueCard } from "../ContinueCard";
import { PosterCard } from "../PosterCard";
import { cardWidth, spacerWidth } from "./rows-constants";

export interface ShelfTrackProps {
  readonly items: readonly ResolvedItem[];
  /** The row left to right: spacers for unmounted cards and the mounted ones (`lib/shelf-window`). */
  readonly segments: readonly ShelfSegment[];
  /** Continue Watching draws its own 16:9 cards; every other shelf draws the grid's poster cards. */
  readonly continuing: boolean;
  /** Card skeletons at the tail while the next page loads. */
  readonly tail: number;
  /** The zero-width sentinel after everything, which the shelf's pager watches. */
  readonly sentinel?: Ref<HTMLLIElement>;
  readonly selected: string | null;
  readonly collections: readonly CollectionRow[];
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
}

/* A Continue card's own fixed width is overridden to fill its column. */
const LANDSCAPE_CARD = "[&>article]:w-full";

/** The contents of one shelf's row: each mounted card is a `data-card` carrying its id and its index in the shelf, so the
 *  keyboard can find it; each spacer is exactly as wide as the cards it stands for (`docs/33` section 2.5). */
export function ShelfTrack({
  items, segments, continuing, tail, sentinel, selected, collections, onSelect, onRemoveWatch,
}: ShelfTrackProps) {
  const width = cardWidth(continuing);
  return (
    <>
      {segments.map((segment, position) => {
        if (segment.kind === "gap") {
          return (
            <li key={`gap-${position}`} aria-hidden className="flex-none"
              style={{ width: spacerWidth(segment.cards, continuing) }} />
          );
        }
        const item = items[segment.index];
        if (item === undefined) return null;
        return (
          <li key={`${item.ref.kind}:${item.ref.id}`} data-card data-id={item.ref.id} data-index={segment.index}
            className="min-w-0 flex-none" style={{ width }}>
            {continuing ? (
              <div className={cn("w-full", LANDSCAPE_CARD)}>
                <ContinueCard item={item} selected={selected === item.ref.id} collections={collections}
                  onSelect={onSelect} onRemoveWatch={onRemoveWatch} />
              </div>
            ) : (
              <PosterCard item={item} selected={selected === item.ref.id} inHistory={false} collections={collections}
                onSelect={onSelect} onRemoveWatch={onRemoveWatch} />
            )}
          </li>
        );
      })}
      {Array.from({ length: tail }, (_, at) => (
        <li key={`tail-${at}`} aria-hidden data-tail className="flex min-w-0 flex-none flex-col gap-1.5" style={{ width }}>
          <span className={cn("block w-full overflow-hidden rounded-card border border-border bg-surface",
            continuing ? "aspect-video" : "aspect-[2/3]")}>
            <span className={cn(FILL, "size-full")} />
          </span>
          <span className={cn(SHIMMER, "w-[80%]")} />
        </li>
      ))}
      <li ref={sentinel} aria-hidden data-sentinel className="w-0 flex-none" />
    </>
  );
}
