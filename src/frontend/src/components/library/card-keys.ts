import type { KeyboardEvent } from "react";
import { cardStep } from "@/lib/library-keys";

/* Enter on a card is the button's own click (select and open Info, `06` section 4.2); only the arrows are handled here. */

/** Arrow, Home and End across the cards of a grid or a list. A card's primary button carries `data-primary`; focus and
 *  the selection move together, and the new card scrolls into view. `ids` lists the cards in the same order. */
export function navigateCards(
  event: KeyboardEvent<HTMLElement>,
  ids: readonly string[],
  onSelect: (id: string) => void,
): void {
  const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-primary]")];
  const index = buttons.findIndex((button) => button === event.target);
  const next = cardStep(event.key, index, buttons.map((button) => button.getBoundingClientRect().top));
  if (next === null) return;
  const target = buttons[next];
  const id = ids[next];
  if (target === undefined || id === undefined) return;
  event.preventDefault();
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "nearest" });
  onSelect(id);
}
