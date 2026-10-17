import { useLibraryPager } from "@/hooks/useLibraryPager";
import { PosterGridSkeleton } from "./PosterGridSkeleton";
import { SkeletonRows } from "@/components/ui/SkeletonRows";

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
  return (
    <div ref={sentinel} aria-label={loading ? "Loading more titles" : undefined}>
      {loading && (view === "list" ? <SkeletonRows count={3} /> : (
        <PosterGridSkeleton count={4} />
      ))}
    </div>
  );
}
