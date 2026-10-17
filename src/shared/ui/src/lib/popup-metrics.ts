import type { PopupSize } from "./popup-types";

/** Content width and body-height cap per size class, in points (the authored popup standard). The host clamps both to
 *  the window, so a class never overflows it. */
export const POPUP_CLASSES: Readonly<Record<PopupSize, { readonly width: number; readonly body: number }>> = {
  compact: { width: 242, body: 240 },
  standard: { width: 460, body: 400 },
  wide: { width: 602, body: 500 },
};

/** The content inset and the frame's one-point border on each side: what a class's width grows by. */
export const POPUP_PAD = 8;
export const POPUP_BORDER = 1;

/** A popup is never nearer than this to a window edge. */
export const POPUP_EDGE = 8;

/** A popup hangs this far under the control that opened it. */
export const POPUP_GAP = 4;

/** With nothing to hang from it sits centred across the work area, this share of the way down it. */
export const POPUP_CENTRE_DEPTH = 0.2;
