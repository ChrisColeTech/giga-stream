import { ONLY_TAB_REASON } from "@/lib/player-copy";
import type { MenuItem } from "@/types/menu";

export interface TabMenuInput {
  /** Tabs other than the one the menu was opened on. */
  readonly othersOpen: number;
  readonly onClose: () => void;
  readonly onCloseOthers: () => void;
  readonly onReveal: () => void;
}

/** The tab context menu of `06` section 5.1: Close, Close others, Reveal in Library. A row with nothing to act on stays
 *  listed and off, with its reason on the row. */
export function tabMenuItems({ othersOpen, onClose, onCloseOthers, onReveal }: TabMenuInput): MenuItem[] {
  const noOthers = othersOpen === 0;
  return [
    { kind: "action", label: "Close", onSelect: onClose },
    {
      kind: "action",
      label: "Close others",
      disabled: noOthers,
      disabledReason: noOthers ? ONLY_TAB_REASON : undefined,
      onSelect: onCloseOthers,
    },
    { kind: "separator" },
    { kind: "action", label: "Reveal in Library", onSelect: onReveal },
  ];
}
