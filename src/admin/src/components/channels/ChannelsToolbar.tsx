import { ToolbarStrip } from "@giga/ui/shell/ToolbarStrip";
import { FORWARD_ICON } from "@/constants/toolbar-icons";
import { usePreviewOpen } from "@/hooks/usePreviewOpen";
import { previewIndexReason } from "@/lib/channel-guard";
import { useAppStore } from "@/store/app-store";

/** The Channels index's page toolbar (`36` section 5.3): the one forward arrow `Preview`, which needs exactly one ticked
 *  row (`Tick a row first`, `Tick only one row`). The bulk verbs are the list's table strip. */
export function ChannelsToolbar() {
  const ticked = useAppStore((state) => state.channels.ticked);
  const openPreview = usePreviewOpen();
  const only = ticked.length === 1 ? ticked[0] : undefined;
  const reason = previewIndexReason(ticked.length);

  return (
    <ToolbarStrip
      label="Channels toolbar"
      verbs={[
        {
          id: "forward",
          label: "Preview",
          icon: FORWARD_ICON,
          ...(reason !== undefined && { reason }),
          onPress: () => {
            if (only !== undefined) openPreview(only);
          },
        },
      ]}
    />
  );
}
