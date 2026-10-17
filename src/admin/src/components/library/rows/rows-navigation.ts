import type { KeyboardEvent } from "react";
import { EDGE_SLACK_PX, ROW_SCROLL_FRACTION } from "./rows-constants";

/** A card in the Rows view: its shelf and its position in that shelf's row. */
export interface RowStop {
  readonly shelf: number;
  readonly card: number;
}

export interface RowEnds {
  readonly atStart: boolean;
  readonly atEnd: boolean;
}

export interface RowMetrics {
  readonly scrollLeft: number;
  readonly clientWidth: number;
  readonly scrollWidth: number;
}

/** The card a key moves to, from the card at `at`. `lengths` is each shelf's card count, in order. Left and Right
 *  stop at the row's ends; Home and End go to its first and last card; Up and Down go to the same card index on the
 *  previous or next shelf, or its last card when that shelf is shorter. Null means the key does nothing here. */
export function rowStep(key: string, at: RowStop, lengths: readonly number[]): RowStop | null {
  const own = lengths[at.shelf];
  if (own === undefined || at.card < 0 || at.card >= own) return null;
  const last = own - 1;
  switch (key) {
    case "ArrowLeft":
      return at.card > 0 ? { shelf: at.shelf, card: at.card - 1 } : null;
    case "ArrowRight":
      return at.card < last ? { shelf: at.shelf, card: at.card + 1 } : null;
    case "Home":
      return at.card > 0 ? { shelf: at.shelf, card: 0 } : null;
    case "End":
      return at.card < last ? { shelf: at.shelf, card: last } : null;
    case "ArrowUp":
      return shelfAt(at.shelf - 1, at.card, lengths);
    case "ArrowDown":
      return shelfAt(at.shelf + 1, at.card, lengths);
    default:
      return null;
  }
}

function shelfAt(shelf: number, card: number, lengths: readonly number[]): RowStop | null {
  const length = lengths[shelf];
  if (length === undefined || length === 0) return null;
  return { shelf, card: Math.min(card, length - 1) };
}

/** Whether a row is at either end of its scroll, with a slack of a pixel for rounding. */
export function rowEnds(metrics: RowMetrics): RowEnds {
  return {
    atStart: metrics.scrollLeft <= EDGE_SLACK_PX,
    atEnd: metrics.scrollLeft + metrics.clientWidth >= metrics.scrollWidth - EDGE_SLACK_PX,
  };
}

/** The distance a chevron press scrolls a row, in pixels. */
export function scrollStep(visibleWidth: number): number {
  return Math.round(visibleWidth * ROW_SCROLL_FRACTION);
}

interface Stop {
  readonly card: HTMLElement;
  readonly button: HTMLButtonElement;
  readonly id: string;
}

/* A card is a `[data-card]` carrying its item id; its first button is the card's keyboard stop (the poster's own
   primary button, or a continue card's Play). */
function stopsOf(root: HTMLElement): Stop[][] {
  return [...root.querySelectorAll<HTMLElement>("[data-shelf]")].map((shelf) =>
    [...shelf.querySelectorAll<HTMLElement>("[data-card]")].flatMap((card) => {
      const button = card.querySelector<HTMLButtonElement>("button");
      const id = card.dataset.id;
      return button === null || id === undefined ? [] : [{ card, button, id }];
    }),
  );
}

/* Focus anywhere inside a card (its Play or Info too) counts as being on that card. */
function locate(stops: readonly (readonly Stop[])[], target: EventTarget | null): RowStop | null {
  if (!(target instanceof Node)) return null;
  for (const [shelf, row] of stops.entries()) {
    const card = row.findIndex((stop) => stop.card.contains(target));
    if (card !== -1) return { shelf, card };
  }
  return null;
}

/** Arrow, Home and End across the Rows view's cards. Focus and the selection move together, and the new card scrolls
 *  into view, its row and the view with it. */
export function navigateRows(event: KeyboardEvent<HTMLElement>, onSelect: (id: string) => void): void {
  const stops = stopsOf(event.currentTarget);
  const at = locate(stops, event.target);
  if (at === null) return;
  const next = rowStep(event.key, at, stops.map((row) => row.length));
  if (next === null) return;
  const stop = stops[next.shelf]?.[next.card];
  if (stop === undefined) return;
  event.preventDefault();
  stop.button.focus({ preventScroll: true });
  stop.button.scrollIntoView({ block: "nearest", inline: "nearest" });
  onSelect(stop.id);
}
