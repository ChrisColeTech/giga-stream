import { NOTHING_CHANGED } from "@/constants/record-copy";
import type { ForwardDestination } from "@/constants/toolbar-icons";

/** One verb of a workspace: where it goes, what it does, and why it cannot be used now. */
export interface ToolbarAction {
  readonly label: ForwardDestination;
  readonly onPress: () => void;
  readonly reason?: string;
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
