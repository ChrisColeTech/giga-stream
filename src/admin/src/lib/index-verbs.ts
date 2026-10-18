import type { StripVerb } from "@giga/ui/lists/TableStrip";
import type { ForwardVerb } from "@/constants/index-frames";
import { FORWARD_ICONS, FORWARD_TOOLTIPS } from "@/constants/toolbar-icons";
import type { Tab } from "@/types/shell";

const NOTHING = (): void => undefined;

/** An index's forward verb for its table strip: an icon (the tooltip names where it goes), or nothing (Accounts, Jobs). A verb with a `to` switches to that tab on its index; a verb with only a `reason` is disabled with it. */
export function indexVerbs(forward: ForwardVerb | null, request: (tab: Tab) => void): readonly StripVerb[] {
  if (forward === null) return [];
  const { to } = forward;
  return [
    {
      id: "forward",
      label: FORWARD_TOOLTIPS[forward.label],
      icon: FORWARD_ICONS[forward.label],
      ...(forward.reason !== undefined && { reason: forward.reason }),
      onPress: to === undefined ? NOTHING : () => request(to),
    },
  ];
}
