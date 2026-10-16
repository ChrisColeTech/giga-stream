import { POPUP_CENTRE_DEPTH, POPUP_EDGE, POPUP_GAP } from "@/constants/popups";
import type { PopupAnchor } from "@/types/overlays";

/** A point for a panel of `width` x `height`, nudged so the whole panel stays `edge` inside a `windowW` x `windowH`
 *  window. Pure, so the placement rule is testable without a DOM. */
export function clampToWindow(
  x: number,
  y: number,
  width: number,
  height: number,
  windowW: number,
  windowH: number,
  edge: number = POPUP_EDGE,
): { readonly x: number; readonly y: number } {
  return {
    x: Math.max(edge, Math.min(x, windowW - width - edge)),
    y: Math.max(edge, Math.min(y, windowH - height - edge)),
  };
}

/** The top edge for a panel of `height` hung from a control spanning `top`..`bottom`: just under it, or, when there is no
 *  room below and enough above, just over it. A panel that fits neither way stays under, and the window clamp keeps it
 *  inside. This is what stops a popup opened from a control near the bottom of the window from covering that control. */
export function hangY(top: number, bottom: number, height: number, windowH: number): number {
  const below = bottom + POPUP_GAP;
  const above = top - POPUP_GAP - height;
  const noRoomBelow = below + height > windowH - POPUP_EDGE;
  return noRoomBelow && above >= POPUP_EDGE ? above : below;
}

function placeAt(panel: HTMLElement, x: number, y: number): void {
  panel.style.maxWidth = `${Math.max(0, window.innerWidth - POPUP_EDGE * 2)}px`;
  panel.style.maxHeight = `${Math.max(0, window.innerHeight - POPUP_EDGE * 2)}px`;
  const at = clampToWindow(x, y, panel.offsetWidth, panel.offsetHeight, window.innerWidth, window.innerHeight);
  panel.style.left = `${at.x}px`;
  panel.style.top = `${at.y}px`;
}

/** A popup whose content grew after it was placed (a list that gained rows) is nudged back inside the window. */
export function keepInWindow(panel: HTMLElement): void {
  const rect = panel.getBoundingClientRect();
  placeAt(panel, rect.left, rect.top);
}

/** Hang a popup off its anchor: under the control, at the point (an item's context menu row), or, opened from the menu
 *  bar, by a key or by the app with no control to hang from, centred in the work area a fifth of the way down. Always
 *  nudged inside the window. One centred place, so a popup never appears sometimes beside its opener and sometimes in
 *  the middle of the screen. */
export function placePopup(panel: HTMLElement, anchor: PopupAnchor): void {
  if (anchor instanceof HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    placeAt(panel, rect.left, hangY(rect.top, rect.bottom, panel.offsetHeight, window.innerHeight));
  } else if (anchor !== null) {
    placeAt(panel, anchor.x, anchor.y);
  } else {
    const area = document.querySelector(".workspace:not(.hidden)")?.getBoundingClientRect();
    const left = area?.left ?? 0;
    const width = area?.width ?? window.innerWidth;
    const height = area?.height ?? window.innerHeight;
    placeAt(
      panel,
      left + (width - panel.offsetWidth) / 2,
      (area?.top ?? 0) + Math.max(POPUP_EDGE, Math.round(height * POPUP_CENTRE_DEPTH)),
    );
  }
}

/** The point just under a control, for `openOverlay(id, anchor)`. */
export function anchorBelow(control: HTMLElement): { readonly x: number; readonly y: number } {
  const rect = control.getBoundingClientRect();
  return { x: rect.left, y: rect.bottom + POPUP_GAP };
}
