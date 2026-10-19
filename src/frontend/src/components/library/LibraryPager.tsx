import { useLibraryPager } from "@/hooks/useLibraryPager";
import type { Scope } from "@/lib/library-query";
import { pagerSkeletonCount } from "@/lib/pager-skeleton";
import { PosterGridSkeleton } from "./PosterGridSkeleton";
import { SkeletonRows } from "@giga/ui/lists/SkeletonRows";

export function LibraryPager({
  hasMore,
  loading,
  view,
  scope,
  onVisible,
}: {
  /** The Media filter's scope: it decides how many kinds, so how many cards, one page adds. */
  readonly scope: Scope;
  readonly hasMore: boolean;
  readonly loading: boolean;
  readonly view: "grid" | "list" | "rows";
  /** Asks for the next page; answers whether one was really requested. */
  readonly onVisible: () => boolean;
}) {
  const sentinel = useLibraryPager(hasMore, loading, view, onVisible);
  if (!hasMore && !loading) return null;
  const count = pagerSkeletonCount(view, scope);
  return (
    <div ref={sentinel} aria-label={loading ? "Loading more titles" : undefined}>
      {loading && (view === "list" ? <SkeletonRows count={count} /> : <PosterGridSkeleton count={count} tail />)}
    </div>
  );
}
