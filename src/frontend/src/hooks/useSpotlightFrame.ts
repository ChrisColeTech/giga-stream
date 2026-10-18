import { useEffect, useRef, type RefObject } from "react";

/** The spotlight's frame behaviour: the card is placed by its own CSS (centred, 14% from the top), and the family
 *  `usePopupFrame` dismissal rules apply (Escape, a press outside the card, which includes the scrim, or focus leaving
 *  it close it), with one difference the `01` section 9 exception needs: while `paused()` answers true (Title
 *  information stands over it) none of them does anything, and Escape is left alone so the window above hears it. */
export function useSpotlightFrame(
  open: boolean,
  paused: () => boolean,
  onClose: () => void,
): RefObject<HTMLDivElement | null> {
  const panel = useRef<HTMLDivElement | null>(null);
  const close = useRef(onClose);
  const isPaused = useRef(paused);
  close.current = onClose;
  isPaused.current = paused;

  useEffect(() => {
    if (!open) return;
    const inside = (target: EventTarget | null): boolean =>
      target instanceof Node && panel.current?.contains(target) === true;
    const away = (event: PointerEvent): void => {
      if (!isPaused.current() && !inside(event.target)) close.current();
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing || isPaused.current()) return;
      event.preventDefault();
      close.current();
    };
    const leave = (event: FocusEvent): void => {
      if (isPaused.current() || !(event.relatedTarget instanceof Node) || inside(event.relatedTarget)) return;
      close.current();
    };
    const node = panel.current;
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", escape);
    node?.addEventListener("focusout", leave);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", escape);
      node?.removeEventListener("focusout", leave);
    };
  }, [open]);

  return panel;
}
