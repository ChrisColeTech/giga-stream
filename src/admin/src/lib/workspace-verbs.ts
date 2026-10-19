import type { ComponentType } from "react";
import type { ButtonVariant } from "@giga/ui/controls/Button";
import { NOTHING_CHANGED } from "@/constants/record-copy";
import type { ForwardDestination } from "@/constants/toolbar-icons";

/** One verb of a workspace: where it goes, what it does, and why it cannot be used now. */
export interface ToolbarAction {
  readonly label: ForwardDestination;
  readonly onPress: () => void;
  readonly reason?: string;
}

/** A workspace toolbar verb whose label is not a forward destination (`Run job`, `Stop`, `53` section 2.3): the small
 *  button's word, its tooltip at rest, why it cannot be used now, its fill and an optional leading icon. */
export interface ToolbarVerb {
  readonly label: string;
  readonly tip?: string;
  readonly reason?: string;
  readonly variant?: ButtonVariant;
  readonly icon?: ComponentType<{ className?: string }>;
  readonly onPress: () => void;
}

/** What a form's last editable group ends with (`SaveDetails`): the press and the reason it cannot be used yet. */
export interface SaveVerb {
  readonly onPress: () => void;
  readonly reason?: string;
}

/** Why `Save details` and `Discard changes` cannot be used: `Nothing has changed.` while the draft equals its baseline;
 *  once something has changed, the page's own reason (a refused value, a call going), else undefined. */
export function changeReason(dirty: boolean, own?: string): string | undefined {
  return dirty ? own : NOTHING_CHANGED;
}
