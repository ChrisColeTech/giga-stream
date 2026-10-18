import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { useReduceMotion } from "@giga/ui/hooks/useReduceMotion";
import { cn } from "@giga/ui/lib/cn";
import { useShelfPager } from "@/hooks/useShelfPager";
import { useShelfView } from "@/hooks/useShelfView";
import { ROWS_TAIL_SKELETONS } from "@/lib/library-limits";
import type { ResolvedItem } from "@/lib/library-marks";
import { shelfSegments } from "@/lib/shelf-window";
import type { CollectionRow } from "@/types/collection";
import { RowChevron } from "./RowChevron";
import { ROW_GAP } from "./rows-constants";
import { backChevron, cardStep, forwardChevron, forwardNeedsPage, scrollStep } from "./rows-navigation";
import { ShelfTrack } from "./ShelfTrack";

export interface ShelfRowProps {
  /** The shelf's id, under which its horizontal position is remembered. */
  readonly id: string;
  readonly name: string;
  readonly items: readonly ResolvedItem[];
  /** Continue Watching draws its own 16:9 cards; every other shelf draws the grid's poster cards. */
  readonly continuing: boolean;
  /** The server has a next page for the shelf. */
  readonly hasMore: boolean;
  readonly paging: boolean;
  readonly positions: Map<string, number>;
  readonly selected: string | null;
  readonly collections: readonly CollectionRow[];
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
  /** Asks for the shelf's next page; answers whether one was asked for. */
  readonly onLoadMore: () => boolean;
}

function indexOf(target: EventTarget): number | null {
  const card = target instanceof Element ? target.closest("[data-index]") : null;
  const index = Number(card?.getAttribute("data-index"));
  return card === null || Number.isNaN(index) ? null : index;
}

/** One shelf's cards in a single horizontal row (`docs/33` section 2). Only the cards near the row's view are mounted;
 *  the row asks for the shelf's next page as its end comes near, with card skeletons at its tail meanwhile. Two edge
 *  chevrons show while the pointer or focus is over the row; `Scroll right` stays enabled while there is more. Left,
 *  Right, Home and End move across the loaded cards by index, mounting the target first. The vertical padding leaves
 *  room for a card's hover lift and shadow, which the scroll box would otherwise clip. */
export function ShelfRow({
  id, name, items, continuing, hasMore, paging, positions, selected, collections, onSelect, onRemoveWatch, onLoadMore,
}: ShelfRowProps) {
  const rowRef = useRef<HTMLUListElement>(null);
  const reduce = useReduceMotion();
  const count = items.length;
  const { range, ends, measure } = useShelfView(rowRef, id, positions, count, continuing);
  const [pinned, setPinned] = useState<number | null>(null);
  const [focusTarget, setFocusTarget] = useState<number | null>(null);
  const sentinel = useShelfPager(rowRef, hasMore, paging, onLoadMore);
  const segments = shelfSegments(range, pinned, count);
  const atTail = segments.at(-1)?.kind !== "gap";

  /* A key's target is mounted (pinned) first, then focused, scrolled into view and selected. */
  useEffect(() => {
    if (focusTarget === null) return;
    setFocusTarget(null);
    const card = rowRef.current?.querySelector<HTMLElement>(`[data-index="${focusTarget}"]`);
    const button = card?.querySelector<HTMLButtonElement>("button");
    const cardId = card?.dataset.id;
    if (button === null || button === undefined || cardId === undefined) return;
    button.focus({ preventScroll: true });
    button.scrollIntoView({ block: "nearest", inline: "nearest" });
    onSelect(cardId);
  }, [focusTarget, onSelect]);

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    const index = indexOf(event.target);
    const next = index === null ? null : cardStep(event.key, index, count);
    if (next === null) return;
    event.preventDefault();
    setPinned(next);
    setFocusTarget(next);
  };
  const onFocus = (event: FocusEvent<HTMLUListElement>): void => {
    const index = indexOf(event.target);
    if (index !== null) setPinned(index);
  };

  const step = (direction: 1 | -1): void => {
    const row = rowRef.current;
    if (row === null) return;
    const metrics = { scrollLeft: row.scrollLeft, clientWidth: row.clientWidth, scrollWidth: row.scrollWidth };
    row.scrollBy({ left: direction * scrollStep(row.clientWidth), behavior: reduce ? "auto" : "smooth" });
    if (direction === 1 && !paging && forwardNeedsPage(metrics, hasMore)) onLoadMore();
  };

  return (
    <div className="group/row relative min-w-0">
      <ul
        ref={rowRef}
        aria-label={name}
        aria-busy={paging}
        onScroll={measure}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        className={cn(
          "m-0 flex list-none overflow-x-auto px-3 py-2",
          ROW_GAP,
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        <ShelfTrack
          items={items}
          segments={segments}
          continuing={continuing}
          tail={paging && atTail ? ROWS_TAIL_SKELETONS : 0}
          sentinel={sentinel}
          selected={selected}
          collections={collections}
          onSelect={onSelect}
          onRemoveWatch={onRemoveWatch}
        />
      </ul>
      <RowChevron direction="back" state={backChevron(ends)} onClick={() => step(-1)} />
      <RowChevron direction="forward" state={forwardChevron(ends, hasMore)} onClick={() => step(1)} />
    </div>
  );
}
