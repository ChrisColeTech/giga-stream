import type { CSSProperties } from "react";
import { Skeleton } from "./Skeleton";

export interface SkeletonCardsProps {
  readonly count: number;
  /** Given, the cards are one horizontal row of fixed-width columns, each this many pixels wide: the poster is 2:3 of
   *  that width, so the row takes its height from the width. Absent, the cards fill a wrapping grid of at least 144 px. */
  readonly cardWidth?: number;
}

/** Poster-card skeletons: a 2:3 picture block over two text bands, the shape of a card in the library grid or, with a
 *  `cardWidth`, of a card in a single row (the Player's related band). */
export function SkeletonCards({ count, cardWidth }: SkeletonCardsProps) {
  const fixed = cardWidth !== undefined;
  const columnStyle: CSSProperties | undefined = fixed ? { width: cardWidth } : undefined;
  return (
    <div className={fixed ? "flex w-max gap-2 p-1" : "grid grid-cols-[repeat(auto-fill,minmax(144px,1fr))] gap-3 p-3"} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={fixed ? "flex flex-none flex-col gap-1.5" : "flex min-w-0 flex-col gap-1.5"} style={columnStyle}>
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-card">
            <Skeleton className="absolute inset-0 rounded-card" />
          </div>
          <Skeleton style={{ width: "80%" }} />
          <Skeleton className="opacity-60" style={{ width: "40%" }} />
        </div>
      ))}
    </div>
  );
}
