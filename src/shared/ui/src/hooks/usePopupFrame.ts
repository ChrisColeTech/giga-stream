import { useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { keepInWindow, placePopup } from "../lib/popup-place";
import type { PopupAnchor, PopupPolicy } from "../lib/popup-types";

/** What every authored popup shares: it hangs off its anchor and stays inside the window as it grows; Escape and the
 *  title's X close it; and, unless its policy keeps it open, so does a press outside it or focus moving to another
 *  control. Escape is consumed by the deepest layer that wants it (`defaultPrevented`), so one press never cascades
 *  through a menu, a field and the popup. Returns the ref for the popup's root. */
export function usePopupFrame(
  anchor: PopupAnchor,
  policy: PopupPolicy,
  onClose: () => void,
  related?: (node: Node) => boolean,
): RefObject<HTMLDivElement | null> {
  const panel = useRef<HTMLDivElement | null>(null);
  const close = useRef(onClose);
  const belongs = useRef(related);
  close.current = onClose;
  belongs.current = related;
  /* An Operation outlives its popup: an outside press or a focus change never dismisses it. */
  const dismissesOutside = policy !== "operation";

  useLayoutEffect(() => {
    if (panel.current !== null) placePopup(panel.current, anchor);
  }, [anchor]);

  /* A popup that grows after it opened (a list that gained a row) stays inside the window: it is placed once for the
     size it opened at, so without this its new rows would run off the bottom edge. */
  useEffect(() => {
    const node = panel.current;
    if (node === null || typeof ResizeObserver === "undefined") return;
    let height = node.offsetHeight;
    const observer = new ResizeObserver(() => {
      if (node.offsetHeight === height) return;
      height = node.offsetHeight;
      keepInWindow(node);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const inside = (node: Node): boolean => panel.current?.contains(node) === true || belongs.current?.(node) === true;
    const away = (event: PointerEvent): void => {
      if (dismissesOutside && !inside(event.target as Node)) close.current();
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
      event.preventDefault();
      close.current();
    };
    const leave = (event: FocusEvent): void => {
      if (dismissesOutside && event.relatedTarget instanceof Node && !inside(event.relatedTarget)) close.current();
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
  }, [dismissesOutside]);

  return panel;
}
