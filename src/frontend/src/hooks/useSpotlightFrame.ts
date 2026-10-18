import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { keepInWindow, placePopup } from "@giga/ui/lib/popup-place";

/** The spotlight's frame: the family `usePopupFrame` rules (placed by `placePopup` with no anchor, so centred across the
 *  work area a fifth of the way down; kept inside the window as it grows; Escape, a press outside it or focus leaving it
 *  dismiss it), with one difference the `01` section 9 exception needs: while `paused()` answers true (Title
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

  useLayoutEffect(() => {
    if (open && panel.current !== null) placePopup(panel.current, null);
  }, [open]);

  useEffect(() => {
    const node = panel.current;
    if (!open || node === null || typeof ResizeObserver === "undefined") return;
    let height = node.offsetHeight;
    const observer = new ResizeObserver(() => {
      if (node.offsetHeight === height) return;
      height = node.offsetHeight;
      keepInWindow(node);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [open]);

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
