import type { ForwardVerb } from "@/constants/index-frames";
import type { ToolbarAction } from "@/lib/workspace-verbs";
import type { Tab } from "@/types/shell";

const NOTHING = (): void => undefined;

/** An index's forward verb for its page toolbar, drawn on the right as the destination's word and `→` (`Titles →`); or
 *  nothing (Accounts, Jobs), and the toolbar is drawn empty. A verb with a `to` switches to that tab; a verb with only a
 *  `reason` is disabled with it. */
export function indexForward(forward: ForwardVerb | null, request: (tab: Tab) => void): ToolbarAction | undefined {
  if (forward === null) return undefined;
  const { to } = forward;
  return {
    label: forward.label,
    ...(forward.reason !== undefined && { reason: forward.reason }),
    onPress: to === undefined ? NOTHING : () => request(to),
  };
}
