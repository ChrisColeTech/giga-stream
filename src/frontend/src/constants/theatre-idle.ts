/** How long Theatre mode waits, with no mouse or keyboard activity, before the title and status bar contents fade
 *  out (owner, 2026-10-17). */
export const THEATRE_IDLE_MS = 5000;

/** The one activity event that carries a position: a move to the same point is not activity (Chrome fires synthetic
 *  moves under a still cursor after layout changes). */
export const THEATRE_MOVE_EVENT = "pointermove";

/** Every event that counts as activity, heard on `window` in the capture phase so nothing in the page can swallow it.
 *  A provider's embedded player is a cross-origin iframe: input inside it never reaches the page. */
export const THEATRE_ACTIVITY_EVENTS: readonly string[] = [
  THEATRE_MOVE_EVENT,
  "pointerdown",
  "wheel",
  "keydown",
  "touchstart",
];

/** Elements whose presence in the document means a menu or dialog is up: the bars never hide under one. */
export const THEATRE_BLOCKING_SELECTOR = '[role="menu"], [role="dialog"], [role="alertdialog"]';

/** A focused element matching this is a text field in use: the bars never hide while one has focus. */
export const THEATRE_FIELD_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
