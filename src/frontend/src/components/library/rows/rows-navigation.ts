import type { KeyboardEvent } from "react";
import { EDGE_SLACK_PX, ROWS_COPY, ROW_SCROLL_FRACTION } from "./rows-constants";

export interface RowEnds {
  readonly atStart: boolean;
  readonly atEnd: boolean;
}

export interface RowMetrics {
  readonly scrollLeft: number;
  readonly clientWidth: number;
  readonly scrollWidth: number;
}

/** A chevron's state: whether it is disabled, and its tooltip (the reason when it is). */
export interface ChevronState {
  readonly disabled: boolean;
  readonly title: string;
}

/** The card a key moves to within a shelf of `count` loaded cards, by index: Left and Right stop at the ends, Home and
 *  End go to the first and last loaded card. Null means the key does nothing here. */
export function cardStep(key: string, index: number, count: number): number | null {
  if (index < 0 || index >= count) return null;
  const to = key === "ArrowLeft" ? index - 1
    : key === "ArrowRight" ? index + 1
      : key === "Home" ? 0
        : key === "End" ? count - 1
          : null;
  return to === null || to < 0 || to >= count || to === index ? null : to;
}

/** The index of the left edge nearest `left`, or -1 when there is none: Up and Down land on the card in the next shelf
 *  that sits closest under or over the focused one. */
export function nearestCard(lefts: readonly number[], left: number): number {
  let best = -1;
  for (const [index, candidate] of lefts.entries()) {
    const current = lefts[best];
    if (current === undefined || Math.abs(candidate - left) < Math.abs(current - left)) best = index;
  }
  return best;
}

/** Whether a row is at either end of its scroll, with a slack of a pixel for rounding. The scroll width includes the
 *  spacers for cards that are not mounted, so "at the end" means past every loaded card. */
export function rowEnds(metrics: RowMetrics): RowEnds {
  return {
    atStart: metrics.scrollLeft <= EDGE_SLACK_PX,
    atEnd: metrics.scrollLeft + metrics.clientWidth >= metrics.scrollWidth - EDGE_SLACK_PX,
  };
}

/** `Scroll right` (`docs/33` section 2.6): enabled while loaded cards lie beyond the view or the server has a next
 *  page; disabled, with its reason, only at the true end. */
export function forwardChevron(ends: RowEnds, hasMore: boolean): ChevronState {
  const disabled = ends.atEnd && !hasMore;
  return { disabled, title: disabled ? ROWS_COPY.atEnd : ROWS_COPY.scrollForward };
}

/** `Scroll left`: disabled, with its reason, at the start. */
export function backChevron(ends: RowEnds): ChevronState {
  return { disabled: ends.atStart, title: ends.atStart ? ROWS_COPY.atStart : ROWS_COPY.scrollBack };
}

/** The distance a chevron press scrolls a row, in pixels. */
export function scrollStep(visibleWidth: number): number {
  return Math.round(visibleWidth * ROW_SCROLL_FRACTION);
}

/** Whether a `Scroll right` press from `metrics` should ask for the next page at once: one step on, the row's end is
 *  within a row width, and the server has more. */
export function forwardNeedsPage(metrics: RowMetrics, hasMore: boolean): boolean {
  if (!hasMore) return false;
  return metrics.scrollLeft + scrollStep(metrics.clientWidth) + 2 * metrics.clientWidth >= metrics.scrollWidth;
}

/* A card is a `[data-card]` carrying its item id; its first button is the card's keyboard stop (the poster's own
   primary button, or a continue card's Play). */
function stopOf(card: HTMLElement): HTMLButtonElement | null {
  return card.querySelector<HTMLButtonElement>("button");
}

/** Up and Down between the Rows view's shelves (Left, Right, Home and End are each shelf's own). Focus and the
 *  selection move to the mounted card of the next shelf nearest the focused one horizontally, among those its row
 *  shows when it shows any. */
export function navigateShelves(event: KeyboardEvent<HTMLElement>, onSelect: (id: string) => void): void {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  const card = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-card]") : null;
  const shelf = card?.closest<HTMLElement>("[data-shelf]");
  if (card === null || card === undefined || shelf === null || shelf === undefined) return;
  const shelves = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-shelf]")];
  const next = shelves[shelves.indexOf(shelf) + (event.key === "ArrowDown" ? 1 : -1)];
  if (next === undefined) return;
  const box = next.querySelector("ul")?.getBoundingClientRect();
  const mounted = [...next.querySelectorAll<HTMLElement>("[data-card]")];
  const shown = box === undefined ? [] : mounted.filter((candidate) => {
    const rect = candidate.getBoundingClientRect();
    return rect.right > box.left && rect.left < box.right;
  });
  const candidates = shown.length > 0 ? shown : mounted;
  const lefts = candidates.map((candidate) => candidate.getBoundingClientRect().left);
  const target = candidates[nearestCard(lefts, card.getBoundingClientRect().left)];
  const button = target === undefined ? null : stopOf(target);
  const id = target?.dataset.id;
  if (button === null || id === undefined) return;
  event.preventDefault();
  button.focus({ preventScroll: true });
  button.scrollIntoView({ block: "nearest", inline: "nearest" });
  onSelect(id);
}
