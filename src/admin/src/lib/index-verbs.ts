import type { ToolbarVerb } from "@giga/ui/shell/ToolbarStrip";
import type { ForwardVerb } from "@/constants/index-frames";
import type { Tab } from "@/types/shell";

const NOTHING = (): void => undefined;

/** An index's strip: its one forward verb, filled, or nothing (Accounts, the last tab). A verb with a `to` switches to that
 *  tab on its index; a verb with only a `reason` is disabled with it. */
export function indexVerbs(forward: ForwardVerb | null, request: (tab: Tab) => void): readonly ToolbarVerb[] {
  if (forward === null) return [];
  const { to } = forward;
  return [
    {
      id: "forward",
      label: forward.label,
      tone: "filled",
      reason: forward.reason,
      onPress: to === undefined ? NOTHING : () => request(to),
    },
  ];
}
