import type { ToolbarVerb } from "@giga/ui/shell/ToolbarStrip";
import { NOTHING_CHANGED } from "@/constants/record-copy";

/** One verb of a workspace's strip: what it says, what it does, and why it cannot be used now. */
export interface ToolbarAction {
  readonly label: string;
  readonly onPress: () => void;
  readonly reason?: string;
}

export interface WorkspaceVerbs {
  /** Whether the draft differs from the saved record. */
  readonly dirty: boolean;
  readonly discard: ToolbarAction;
  readonly save: ToolbarAction;
  /** The one forward verb (`Titles →`), filled; absent on a page that has none (Accounts). */
  readonly forward?: ToolbarAction;
}

const verb = (id: string, tone: ToolbarVerb["tone"], action: ToolbarAction, reason?: string): ToolbarVerb => ({
  id,
  tone,
  label: action.label,
  onPress: action.onPress,
  reason,
});

/** A workspace's strip, in order: `Discard changes` (ghost), `Save` (edged), the forward verb (filled). Discard and Save
 *  are disabled with `Nothing has changed.` while the draft equals its baseline; a reason the page gives (a refused
 *  value) takes the place of that once something has changed. The forward verb carries only its own reason. */
export function workspaceVerbs({ dirty, discard, save, forward }: WorkspaceVerbs): readonly ToolbarVerb[] {
  const idle = dirty ? undefined : NOTHING_CHANGED;
  return [
    verb("discard", "ghost", discard, idle ?? discard.reason),
    verb("save", "edged", save, idle ?? save.reason),
    ...(forward === undefined ? [] : [verb("forward", "filled", forward, forward.reason)]),
  ];
}
