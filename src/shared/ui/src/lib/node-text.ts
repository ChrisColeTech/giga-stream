import type { ReactNode } from "react";

/** The plain text a node would read as: its strings and numbers, joined; elements (an icon) and empty values add
 *  nothing. A control's verb for the tooltip label of a disabled button comes from its children this way. */
export function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("").trim();
  return "";
}
