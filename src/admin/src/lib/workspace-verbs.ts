import type { StripVerb } from "@giga/ui/lists/TableStrip";
import { NOTHING_CHANGED } from "@/constants/record-copy";
import { FORWARD_ICONS, FORWARD_TOOLTIPS, type ForwardDestination } from "@/constants/toolbar-icons";

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

/** One forward verb as an icon verb whose tooltip names where it goes (`Go to Titles`, `Preview channel`), or nothing.
 *  It carries only its own reason. Save and Discard are not here (`changeReason`). */
export function forwardVerbs(forward: ToolbarAction | undefined): readonly StripVerb[] {
  if (forward === undefined) return [];
  return [
    {
      id: "forward",
      label: FORWARD_TOOLTIPS[forward.label],
      icon: FORWARD_ICONS[forward.label],
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
