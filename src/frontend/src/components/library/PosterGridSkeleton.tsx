import { SkeletonCards } from "@giga/ui/lists/SkeletonCards";

/** Loaded and waiting posters share their columns, spacing and 2:3 artwork geometry. */
export const POSTER_GRID = "grid grid-cols-[repeat(auto-fill,minmax(144px,1fr))] gap-3 p-3";
/** The same grid without its top padding: the loaded grid's own bottom padding already is the gap to the next card. */
const POSTER_GRID_TAIL = "grid grid-cols-[repeat(auto-fill,minmax(144px,1fr))] gap-3 px-3 pb-3";

/** `tail` sets the placeholders directly beneath the loaded grid, on the same columns, where the next cards land. */
export function PosterGridSkeleton({ count, tail = false }: { readonly count: number; readonly tail?: boolean }) {
  const grid = tail ? POSTER_GRID_TAIL : POSTER_GRID;
  return <SkeletonCards count={count} className={`${grid} [&>div>span:first-child]:aspect-[2/3]`} />;
}
