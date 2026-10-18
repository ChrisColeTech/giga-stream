import { ArrowRight } from "lucide-react";
import type { ToolbarVerb } from "@giga/ui/shell/ToolbarStrip";
import { NOTHING_CHANGED } from "@/constants/record-copy";

/** One verb of a workspace: what it says, what it does, and why it cannot be used now. */
export interface ToolbarAction {
  readonly label: string;
  readonly onPress: () => void;
  readonly reason?: string;
}

/** What a form's last editable group ends with (`SaveDetails`): the press and the reason it cannot be used yet. */
export interface SaveVerb {
  readonly onPress: () => void;
  readonly reason?: string;
}

/** A workspace's page toolbar (`01` section 9): only its forward verb, an arrow icon whose tooltip names the tab it goes
 *  to (`Titles`), or nothing (Accounts). Save and Discard are not here: Save ends the form's body and Discard is the form's
 *  ghost verb (`changeReason`). The forward verb carries only its own reason. */
export function forwardVerbs(forward: ToolbarAction | undefined): readonly ToolbarVerb[] {
  if (forward === undefined) return [];
  return [
    {
      id: "forward",
      label: forward.label,
      icon: ArrowRight,
      onPress: forward.onPress,
      ...(forward.reason !== undefined && { reason: forward.reason }),
    },
  ];
}

/** Why `Save details` and `Discard changes` cannot be used: `Nothing has changed.` while the draft equals its baseline;
 *  once something has changed, the page's own reason (a refused value, a call going), else undefined. */
export function changeReason(dirty: boolean, own?: string): string | undefined {
  return dirty ? own : NOTHING_CHANGED;
}
