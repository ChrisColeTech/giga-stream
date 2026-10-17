import { useCallback, useRef, useState, type KeyboardEvent, type SyntheticEvent } from "react";

/** The open state of one card's details popover, and the keys and presses that must stay inside it. Dismissal (Escape,
 *  an outside press, focus leaving) is the popup frame's (`usePopupFrame`); the glyph that opened it counts as inside,
 *  so a second press of the glyph reaches `toggle` and closes it. Opening another card's popover is an outside press
 *  to this one, so only one is ever open. */
export function useDetailsPopover() {
  const [open, setOpen] = useState(false);
  const glyph = useRef<HTMLButtonElement>(null);

  const toggle = useCallback(() => setOpen((value) => !value), []);
  const close = useCallback(() => {
    setOpen(false);
    /* Closed from inside (Escape, the X), focus would be lost with the panel: hand it back to the glyph. */
    const active = document.activeElement;
    if (active === null || active === document.body || active.closest("[data-popup]") !== null) glyph.current?.focus();
  }, []);
  const belongs = useCallback((node: Node) => glyph.current?.contains(node) === true, []);

  /* The popover is portaled, but React events still bubble to the card: a press or context menu on the glyph or the
     popover must not select the card or open its menu. */
  const keepPress = useCallback((event: SyntheticEvent) => event.stopPropagation(), []);
  /* Arrows move the grid's selection; Escape must reach the document, where the frame closes the popover. */
  const keepKeys = useCallback((event: KeyboardEvent) => {
    if (event.key !== "Escape") event.stopPropagation();
  }, []);

  return { open, glyph, toggle, close, belongs, keepPress, keepKeys };
}
