import { emit } from "@giga/ui/lib/bus";
import type { MenuItem } from "@/types/menu";

/**
 * Summon the app's one context menu at the pointer.
 *
 * Call it from an `onContextMenu` handler or a menu-button click; the shell's `useContextMenu` is listening and owns
 * the rendering, the placement and the dismissal. Falsy entries are dropped, so a caller can build its list with inline
 * conditionals without filtering by hand.
 */
export function openMenu(
  event: { clientX: number; clientY: number; preventDefault: () => void; stopPropagation: () => void },
  items: Array<MenuItem | false | null | undefined>,
): void {
  /* preventDefault kills the OS menu; stopPropagation stops a parent's own handler from opening a second one behind. */
  event.preventDefault();
  event.stopPropagation();
  emit("menu:open", {
    anchor: { x: event.clientX, y: event.clientY },
    items: items.filter((item): item is MenuItem => Boolean(item)),
  });
}
