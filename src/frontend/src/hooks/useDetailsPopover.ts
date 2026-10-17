import { useCallback, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type SyntheticEvent } from "react";
import { DETAILS_CLOSE_GRACE_MS, DETAILS_OPEN_DELAY_MS } from "@/constants/details-hover";
import { createDetailsHover, createHoverGroup, type DetailsHover } from "@/lib/details-hover-controller";

/* One group for the whole grid: opening a card's popover closes whichever other card's is open. */
const group = createHoverGroup();

/** A device that can hover shows the popover by hovering; one that cannot (touch) shows it by pressing the glyph. */
const canHover = (): boolean => typeof window.matchMedia === "function" && window.matchMedia("(hover: hover)").matches;

/** The open state of one card's details popover, shown like a tooltip (`06` section 4.2): after a short rest of the
 *  pointer on the glyph, or at once by keyboard focus; hidden when the pointer and focus have both left (after a short
 *  grace so the pointer can cross onto the popover), on Escape, an outside press, or the popover's X. The timing rules
 *  are `lib/details-hover-controller`; this hook only wires the DOM to them and owns the timers. The popover is
 *  portaled, but React's enter, leave and focus events still reach the wrapper that holds both, so one set of handlers
 *  covers the glyph and the popover. The popover never takes focus. */
export function useDetailsPopover() {
  const [open, setOpen] = useState(false);
  const glyph = useRef<HTMLButtonElement>(null);
  const hover = useRef<DetailsHover | null>(null);
  /* Handing focus back to the glyph after the popover closed is not the keyboard arriving on it. */
  const restoring = useRef(false);

  useEffect(() => {
    const controller = createDetailsHover({
      schedule: (task, delay) => window.setTimeout(task, delay),
      cancel: (id) => window.clearTimeout(id),
      openDelay: DETAILS_OPEN_DELAY_MS,
      closeGrace: DETAILS_CLOSE_GRACE_MS,
      group,
      onOpen: () => setOpen(true),
      onClose: () => setOpen(false),
    });
    hover.current = controller;
    return () => {
      controller.dispose();
      hover.current = null;
    };
  }, []);

  const close = useCallback(() => {
    hover.current?.close();
    /* Closed from inside (Escape, the X), focus would be lost with the panel: hand it back to the glyph. */
    const active = document.activeElement;
    if (active === null || active === document.body || active.closest("[data-popup]") !== null) {
      restoring.current = true;
      glyph.current?.focus();
      restoring.current = false;
    }
  }, []);
  const belongs = useCallback((node: Node) => glyph.current?.contains(node) === true, []);

  /* Mouse and pen only: a touch's emulated enter has no leave to match it, and touch presses toggle instead. */
  const onPointerEnter = useCallback((event: SyntheticEvent & { pointerType?: string }) => {
    if (event.pointerType !== "touch") hover.current?.pointerEnter();
  }, []);
  const onPointerLeave = useCallback(() => hover.current?.pointerLeave(), []);
  /* Keyboard focus on the glyph (a mouse press focuses it too, but is not `:focus-visible`), or focus inside the popover. */
  const onFocus = useCallback((event: FocusEvent) => {
    if (restoring.current) return;
    const target = event.target;
    const keyboard = target === glyph.current && target instanceof Element ? target.matches(":focus-visible") : true;
    if (keyboard) hover.current?.focus();
  }, []);
  const onBlur = useCallback(() => hover.current?.blur(), []);
  const onPress = useCallback(() => {
    if (!canHover()) hover.current?.toggle();
  }, []);

  /* The popover is portaled, but React events still bubble to the card: a press or context menu on the glyph or the
     popover must not select the card, open Title information or open its menu. */
  const keepPress = useCallback((event: SyntheticEvent) => event.stopPropagation(), []);
  /* Keys on the glyph are not the card's; Escape must reach the document, where the frame closes the popover. */
  const keepKeys = useCallback((event: KeyboardEvent) => {
    if (event.key !== "Escape") event.stopPropagation();
  }, []);

  return { open, glyph, close, belongs, onPointerEnter, onPointerLeave, onFocus, onBlur, onPress, keepPress, keepKeys };
}
