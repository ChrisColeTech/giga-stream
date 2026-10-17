import { useLibraryPager } from "@/hooks/useLibraryPager";
import { pagerSkeletonCount } from "@/lib/pager-skeleton";
import { PosterGridSkeleton } from "./PosterGridSkeleton";
import { SkeletonRows } from "@giga/ui/lists/SkeletonRows";

export function LibraryPager({
  hasMore,
  loading,
  view,
  onVisible,
}: {
  readonly hasMore: boolean;
  readonly loading: boolean;
  readonly view: "grid" | "list" | "rows";
  /** Asks for the next page; answers whether one was really requested. */
  readonly onVisible: () => boolean;
}) {
  const sentinel = useLibraryPager(hasMore, loading, view, onVisible);
  if (!hasMore && !loading) return null;
  const count = pagerSkeletonCount(view);
  return (
    <div ref={sentinel} aria-label={loading ? "Loading more titles" : undefined}>
      {loading && (view === "list" ? <SkeletonRows count={count} /> : <PosterGridSkeleton count={count} tail />)}
    </div>
  );
}
