const NOT_TEXT = new Set(["checkbox", "radio", "range", "button", "submit", "reset", "color", "file", "image"]);

/** Whether an element owns Escape because it accepts typed text. */
export function isTextField(node: Element): boolean {
  if (node.closest("[contenteditable]:not([contenteditable='false'])") !== null) return true;
  if (node.matches("textarea, select")) return true;
  return node.matches("input") && !NOT_TEXT.has((node as HTMLInputElement).type);
}
