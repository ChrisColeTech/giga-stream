import { useEffect, useRef, type RefObject } from "react";
import { libraryStallEvent } from "@/lib/library-events";
import { PAGER_LOOK_AHEAD } from "@/lib/library-limits";
import {
  mayChain, nearestScroller, pagerCanRequest, pagerStalled, requestVisiblePageOnce, withinLookAhead,
} from "@/lib/library-pager";
import { useAppStore } from "@/store/app-store";

/** Owns the Library's end-of-list sentinel. The observer is rooted at the sentinel's own scroller, so the look-ahead
 *  margin really applies (with an implicit root it only grows the viewport and the scroller still clips the sentinel).
 *  An observer reports changes only, so every time one is created (after each page append) the position is checked
 *  once by hand: a page that does not fill the pane chains the next. `onVisible` answers whether a page was requested. */
export function useLibraryPager(
  hasMore: boolean,
  loading: boolean,
  view: string,
  onVisible: () => boolean,
): RefObject<HTMLDivElement | null> {
  const sentinel = useRef<HTMLDivElement>(null);
  const visibleRequest = useRef(onVisible);
  visibleRequest.current = onVisible;
  const unscrolled = useRef(0);
  useEffect(() => {
    const node = sentinel.current;
    if (node === null || !hasMore || loading) return;
    const root = nearestScroller(node);
    const active = { current: false };
    let warned = false;
    const request = (inRange: boolean): void => {
      if (!inRange || !mayChain(unscrolled.current)) return;
      const requested = requestVisiblePageOnce(active, () => visibleRequest.current());
      if (requested) unscrolled.current += 1;
      if (!warned && pagerStalled({ hasMore, loading, inRange, requested: requested || active.current })) {
        warned = true;
        useAppStore.getState().logEvent(libraryStallEvent());
      }
    };
    // The observer also fires when a hidden surface is shown again, which is the one re-check a hidden Library needs.
    const observer = new IntersectionObserver((entries) => {
      request(entries.some((entry) => entry.isIntersecting && pagerCanRequest(entry.rootBounds)));
    }, { root, rootMargin: `${PAGER_LOOK_AHEAD}px` });
    observer.observe(node);
    const box = root === null
      ? { top: 0, bottom: window.innerHeight }
      : root.getBoundingClientRect();
    request(withinLookAhead(node.getBoundingClientRect(), box));
    const scrolled = (): void => { unscrolled.current = 0; };
    const scrollTarget: HTMLElement | Window = root ?? window;
    scrollTarget.addEventListener("scroll", scrolled, { passive: true });
    return () => {
      observer.disconnect();
      scrollTarget.removeEventListener("scroll", scrolled);
    };
  }, [hasMore, loading, view]);
  return sentinel;
}
