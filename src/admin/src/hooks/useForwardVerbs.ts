import { INDEX_FRAMES } from "@/constants/index-frames";
import { usePreviewOpen } from "@/hooks/usePreviewOpen";
import { previewIndexReason } from "@/lib/channel-guard";
import { indexForward } from "@/lib/index-verbs";
import type { ToolbarAction } from "@/lib/workspace-verbs";
import { useAppStore } from "@/store/app-store";
import type { Tab } from "@/types/shell";

/** An index's ONE forward verb for its page toolbar, on the right as its word and `→` (`01` section 9 Page toolbar):
 *  `Titles →` where the index has a forward tab, and on Channels `Preview →`, which needs exactly one ticked row (`Tick a
 *  row first`, `Tick only one row`). Accounts and Jobs have none. */
export function useForwardVerbs(tab: Tab): ToolbarAction | undefined {
  const requestTab = useAppStore((state) => state.requestTab);
  const tickedCount = useAppStore((state) => state.channels.ticked.length);
  const only = useAppStore((state) => (state.channels.ticked.length === 1 ? state.channels.ticked[0] : undefined));
  const openPreview = usePreviewOpen();
  if (tab !== "channels") return indexForward(INDEX_FRAMES[tab].forward, (to) => requestTab(to));
  const reason = previewIndexReason(tickedCount);
  return {
    label: "Preview",
    ...(reason !== undefined && { reason }),
    onPress: () => {
      if (only !== undefined) openPreview(only);
    },
  };
}
