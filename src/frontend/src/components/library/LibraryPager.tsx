import { useEffect, useRef } from "react";
import { SkeletonCards } from "@/components/ui/SkeletonCards";
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
  readonly onVisible: () => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (node === null || !hasMore || loading) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onVisible();
    }, { rootMargin: "240px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, onVisible]);

  if (!hasMore && !loading) return null;
  return (
    <div ref={sentinel} aria-label={loading ? "Loading more titles" : undefined}>
      {loading && (view === "list" ? <SkeletonRows count={3} /> : (
        <SkeletonCards count={4} className="grid grid-cols-[repeat(auto-fill,minmax(144px,1fr))] gap-3 p-3" />
      ))}
    </div>
  );
}
