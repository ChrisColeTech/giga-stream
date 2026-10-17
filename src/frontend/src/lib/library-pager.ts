import { PAGER_LOOK_AHEAD } from "@/lib/library-limits";

/** The vertical extent of a box, in the same coordinate space as its partner (client rects). */
export interface Span {
  readonly top: number;
  readonly bottom: number;
}

/** True when the sentinel lies inside the scroller's box grown by the look-ahead on both edges. A zero-height
 *  sentinel exactly on an edge counts, as it does for an IntersectionObserver. */
export function withinLookAhead(sentinel: Span, root: Span, margin: number = PAGER_LOOK_AHEAD): boolean {
  return sentinel.top <= root.bottom + margin && sentinel.bottom >= root.top - margin;
}

/** Asks for a page unless one is already being asked for. `request` answers whether a page really was requested; a
 *  declined request releases the guard so the next evaluation may try again (it never leaves the guard stuck). */
export function requestVisiblePageOnce(active: { current: boolean }, request: () => boolean): boolean {
  if (active.current) return false;
  active.current = true;
  const requested = request();
  if (!requested) active.current = false;
  return requested;
}

export interface PagerState {
  readonly hasMore: boolean;
  readonly loading: boolean;
  readonly inRange: boolean;
  readonly requested: boolean;
}

/** The stall: the page wants more, nothing is loading, the sentinel is in range, and still no page was requested. */
export function pagerStalled(state: PagerState): boolean {
  return state.hasMore && !state.loading && state.inRange && !state.requested;
}

/** The nearest ancestor that scrolls vertically, or null when none does (the viewport is then the root). */
export function nearestScroller(node: HTMLElement): HTMLElement | null {
  for (let parent = node.parentElement; parent !== null; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY;
    if (overflow === "auto" || overflow === "scroll" || overflow === "overlay") return parent;
  }
  return null;
}
