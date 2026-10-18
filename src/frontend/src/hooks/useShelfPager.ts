import { useEffect, useRef, type RefObject } from "react";
import { ROWS_LOOK_AHEAD } from "@/lib/library-limits";
import { requestVisiblePageOnce } from "@/lib/library-pager";
import { shelfWantsPage, withinHorizontalLookAhead } from "@/lib/shelf-window";

/** Owns a shelf's end sentinel (`docs/33` section 2.4). The observer is rooted at the shelf's own horizontal scroller,
 *  with the look-ahead as a horizontal margin, so the next page is asked for as the end comes near. An observer reports
 *  changes only, so each time one is made (after every page) the position is checked once by hand. A row without width
 *  never asks; at most `MAX_UNSCROLLED_PAGES` are chained without the user scrolling the row. `onVisible` answers
 *  whether a page was asked for. */
export function useShelfPager(
  row: RefObject<HTMLElement | null>,
  hasMore: boolean,
  paging: boolean,
  onVisible: () => boolean,
): RefObject<HTMLLIElement | null> {
  const sentinel = useRef<HTMLLIElement>(null);
  const visible = useRef(onVisible);
  visible.current = onVisible;
  const unscrolled = useRef(0);

  useEffect(() => {
    const node = sentinel.current;
    const root = row.current;
    if (node === null || root === null || !hasMore || paging) return undefined;
    const asking = { current: false };
    const check = (inRange: boolean): void => {
      const state = { hasMore, paging, rowWidth: root.clientWidth, inRange, unscrolled: unscrolled.current };
      if (!shelfWantsPage(state)) return;
      if (requestVisiblePageOnce(asking, () => visible.current())) unscrolled.current += 1;
    };
    const observer = new IntersectionObserver((entries) => {
      check(entries.some((entry) => entry.isIntersecting && (entry.rootBounds?.width ?? 0) > 0));
    }, { root, rootMargin: `0px ${ROWS_LOOK_AHEAD}px` });
    observer.observe(node);
    check(withinHorizontalLookAhead(node.getBoundingClientRect(), root.getBoundingClientRect()));
    const scrolled = (): void => { unscrolled.current = 0; };
    root.addEventListener("scroll", scrolled, { passive: true });
    return () => {
      observer.disconnect();
      root.removeEventListener("scroll", scrolled);
    };
  }, [row, hasMore, paging]);

  return sentinel;
}
