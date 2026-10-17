import { useEffect, useRef } from "react";
import { SkeletonCards } from "@/components/ui/SkeletonCards";
import { SkeletonRows } from "@/components/ui/SkeletonRows";

export function requestVisiblePageOnce(active: { current: boolean }, request: () => void): void {
  if (active.current) return;
  active.current = true;
  request();
}

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
  const requestActive = useRef(false);
  const visibleRequest = useRef(onVisible);
  visibleRequest.current = onVisible;
  useEffect(() => {
    const node = sentinel.current;
    if (node === null || !hasMore || loading) {
      requestActive.current = true;
      return;
    }
    requestActive.current = false;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        requestVisiblePageOnce(requestActive, () => visibleRequest.current());
      }
    }, { rootMargin: "240px" });
    observer.observe(node);
    return () => {
      requestActive.current = true;
      observer.disconnect();
    };
  }, [hasMore, loading]);

  if (!hasMore && !loading) return null;
  return (
    <div ref={sentinel} aria-label={loading ? "Loading more titles" : undefined}>
      {loading && (view === "list" ? <SkeletonRows count={3} /> : (
        <SkeletonCards count={4} className="grid grid-cols-[repeat(auto-fill,minmax(144px,1fr))] gap-3 p-3" />
      ))}
    </div>
  );
}
