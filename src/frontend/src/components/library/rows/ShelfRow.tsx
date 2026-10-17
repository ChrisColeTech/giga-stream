import { useCallback, useEffect, useRef, useState } from "react";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { cn } from "@/lib/cn";
import type { ResolvedItem } from "@/lib/library-marks";
import type { CollectionRow } from "@/types/collection";
import { ContinueCard } from "../ContinueCard";
import { PosterCard } from "../PosterCard";
import { RowChevron } from "./RowChevron";
import { rowEnds, scrollStep, type RowEnds } from "./rows-navigation";

export interface ShelfRowProps {
  readonly name: string;
  readonly items: readonly ResolvedItem[];
  /** Continue Watching draws its own 16:9 cards; every other shelf draws the grid's poster cards. */
  readonly continuing: boolean;
  readonly selected: string | null;
  readonly collections: readonly CollectionRow[];
  readonly onSelect: (id: string) => void;
  readonly onRemoveWatch: (item: ResolvedItem) => void;
}

/* Each card is a `data-card` carrying its id, so the Rows view can find its keyboard stop and move the selection. */
const CARD_WIDTH = "w-40";

/** One shelf's cards in a single horizontal row (`06` section 4, Rows). Two edge chevrons show while the pointer or
 *  focus is over the row, and sit disabled at the ends. */
export function ShelfRow({
  name,
  items,
  continuing,
  selected,
  collections,
  onSelect,
  onRemoveWatch,
}: ShelfRowProps) {
  const rowRef = useRef<HTMLUListElement>(null);
  const [ends, setEnds] = useState<RowEnds>({ atStart: true, atEnd: false });
  const reduce = useReduceMotion();

  /* Where the row stands at either end, measured on scroll and when the row's box resizes. No timers, no requests. */
  const measure = useCallback((): void => {
    const row = rowRef.current;
    if (row === null) return;
    const next = rowEnds({ scrollLeft: row.scrollLeft, clientWidth: row.clientWidth, scrollWidth: row.scrollWidth });
    setEnds((previous) => (previous.atStart === next.atStart && previous.atEnd === next.atEnd ? previous : next));
  }, []);

  useEffect(() => {
    const row = rowRef.current;
    if (row === null) return undefined;
    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(row);
    return () => observer.disconnect();
  }, [measure]);

  const step = (direction: 1 | -1): void => {
    const row = rowRef.current;
    if (row === null) return;
    row.scrollBy({ left: direction * scrollStep(row.clientWidth), behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="group/row relative min-w-0">
      <ul
        ref={rowRef}
        aria-label={name}
        onScroll={measure}
        className={cn(
          "m-0 flex list-none gap-3 overflow-x-auto px-3 py-1",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {items.map((item) => (
          <li
            key={`${item.ref.kind}:${item.ref.id}`}
            data-card
            data-id={item.ref.id}
            className={cn("flex-none", continuing ? "rounded-card" : CARD_WIDTH)}
          >
            {continuing ? (
              <div className={cn("rounded-card", selected === item.ref.id && "ring-2 ring-accent")}>
                <ContinueCard item={item} />
              </div>
            ) : (
              <PosterCard
                item={item}
                selected={selected === item.ref.id}
                inHistory={false}
                collections={collections}
                onSelect={onSelect}
                onRemoveWatch={onRemoveWatch}
              />
            )}
          </li>
        ))}
      </ul>
      <RowChevron direction="back" disabled={ends.atStart} onClick={() => step(-1)} />
      <RowChevron direction="forward" disabled={ends.atEnd} onClick={() => step(1)} />
    </div>
  );
}
