import type { MenuItem } from "@/types/menu";

export interface StageMenuInput {
  readonly onReveal: () => void;
  readonly onClose: () => void;
}

/** The stage toolbar's menu (`06` section 5.1): Reveal in Library and Close. Both act at once, so neither is off. */
export function stageMenuItems({ onReveal, onClose }: StageMenuInput): MenuItem[] {
  return [
    { kind: "action", label: "Reveal in Library", onSelect: onReveal },
    { kind: "separator" },
    { kind: "action", label: "Close", onSelect: onClose },
  ];
}
