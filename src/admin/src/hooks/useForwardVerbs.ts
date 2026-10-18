import type { StripVerb } from "@giga/ui/lists/TableStrip";
import { INDEX_FRAMES } from "@/constants/index-frames";
import { FORWARD_ICONS, FORWARD_TOOLTIPS } from "@/constants/toolbar-icons";
import { usePreviewOpen } from "@/hooks/usePreviewOpen";
import { previewIndexReason } from "@/lib/channel-guard";
import { indexVerbs } from "@/lib/index-verbs";
import { useAppStore } from "@/store/app-store";
import type { Tab } from "@/types/shell";

/** The cross-tab verbs of an index, as icon buttons for its table strip (there is no page toolbar): `Go to <tab>` where
 *  the index has a forward tab, and on Channels `Preview channel`, which needs exactly one ticked row (`Tick a row
 *  first`, `Tick only one row`). Accounts and Jobs have none. */
export function useForwardVerbs(tab: Tab): readonly StripVerb[] {
  const requestTab = useAppStore((state) => state.requestTab);
  const tickedCount = useAppStore((state) => state.channels.ticked.length);
  const only = useAppStore((state) => (state.channels.ticked.length === 1 ? state.channels.ticked[0] : undefined));
  const openPreview = usePreviewOpen();
  if (tab !== "channels") return indexVerbs(INDEX_FRAMES[tab].forward, (to) => requestTab(to));
  const reason = previewIndexReason(tickedCount);
  return [
    {
      id: "preview",
      label: FORWARD_TOOLTIPS.Preview,
      icon: FORWARD_ICONS.Preview,
      ...(reason !== undefined && { reason }),
      onPress: () => {
        if (only !== undefined) openPreview(only);
      },
    },
  ];
}
