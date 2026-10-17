import { SkeletonCards } from "@/components/ui/SkeletonCards";

/** Loaded and waiting posters share their columns, spacing and 2:3 artwork geometry. */
export const POSTER_GRID = "grid grid-cols-[repeat(auto-fill,minmax(144px,1fr))] gap-3 p-3";

export function PosterGridSkeleton({ count }: { readonly count: number }) {
  return <SkeletonCards count={count} className={`${POSTER_GRID} [&>div>span:first-child]:aspect-[2/3]`} />;
}
