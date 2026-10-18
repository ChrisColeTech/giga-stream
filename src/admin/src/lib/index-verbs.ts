import type { StripForward } from "@giga/ui/lists/TableStrip";
import type { ForwardVerb } from "@/constants/index-frames";
import { FORWARD_TOOLTIPS } from "@/constants/toolbar-icons";
import type { Tab } from "@/types/shell";

const NOTHING = (): void => undefined;

/** An index's forward verb for its selection toolbar: the destination's word, drawn with `→` rightmost (`Titles →`), and
 *  a tooltip naming where it goes; or nothing (Accounts, Jobs). A verb with a `to` switches to that tab; a verb with only
 *  a `reason` is disabled with it. */
export function indexForward(forward: ForwardVerb | null, request: (tab: Tab) => void): StripForward | undefined {
  if (forward === null) return undefined;
  const { to } = forward;
  return {
    word: forward.label,
    tip: FORWARD_TOOLTIPS[forward.label],
    ...(forward.reason !== undefined && { reason: forward.reason }),
    onPress: to === undefined ? NOTHING : () => request(to),
  };
}
