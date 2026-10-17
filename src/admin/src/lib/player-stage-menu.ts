import type { MenuItem } from "@giga/ui/menus/types";

type Submenu = Extract<MenuItem, { kind: "submenu" }>;

export interface StageMenuInput {
  readonly fullscreen: boolean;
  readonly favorite: boolean;
  /** The `Collections ▸` submenu for the open item. */
  readonly collections: Submenu;
  /** Present when the item has a watch entry to remove. */
  readonly onRemoveHistory?: () => void;
  readonly onRetry: () => void;
  readonly onFullscreen: () => void;
  readonly onReveal: () => void;
  readonly onFavorite: () => void;
  readonly onClose: () => void;
}

/** The stage's context menu (`06` sections 5.1 and 5.3): the verbs that had a toolbar of their own, summoned on the
 *  picture instead, so the canvas is the video alone. Playback verbs first, then the item's marks, then Close. */
export function stageMenuItems(input: StageMenuInput): MenuItem[] {
  const items: MenuItem[] = [
    { kind: "action", label: "Retry", onSelect: input.onRetry },
    { kind: "action", label: input.fullscreen ? "Exit full screen" : "Full screen", onSelect: input.onFullscreen },
    { kind: "action", label: "Reveal in Library", onSelect: input.onReveal },
    { kind: "separator" },
    { kind: "action", label: input.favorite ? "Unfavorite" : "Favorite", onSelect: input.onFavorite },
    input.collections,
  ];
  if (input.onRemoveHistory !== undefined) {
    /* Not danger at rest: removing one watch entry touches no file and is not a destructive verb (`01` section 9). */
    items.push({ kind: "action", label: "Remove from History", onSelect: input.onRemoveHistory });
  }
  items.push({ kind: "separator" }, { kind: "action", label: "Close", onSelect: input.onClose });
  return items;
}
