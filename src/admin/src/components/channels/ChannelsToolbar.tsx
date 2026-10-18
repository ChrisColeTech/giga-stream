import { ToolbarStrip, type ToolbarVerb } from "@giga/ui/shell/ToolbarStrip";
import { BulkNotes } from "@/components/records/BulkNotes";
import type { ChannelBulk } from "@/hooks/useChannelBulk";
import { usePreviewOpen } from "@/hooks/usePreviewOpen";
import { previewIndexReason } from "@/lib/channel-guard";
import { useAppStore } from "@/store/app-store";

/** The Channels index's strip (`36` section 5.3): the ghost bulk verbs `Enable`, `Disable`, `Rebuild` and the armed
 *  `Delete N channels?` on the ticked rows, then the one filled forward verb `Preview →`, which needs exactly one ticked
 *  row (`Tick a row first`, `Tick only one row`). What a run could not do is listed under the strip. */
export function ChannelsToolbar({ bulk }: { readonly bulk: ChannelBulk }) {
  const ticked = useAppStore((state) => state.channels.ticked);
  const openPreview = usePreviewOpen();
  const only = ticked.length === 1 ? ticked[0] : undefined;
  const verbs: ToolbarVerb[] = bulk.verbs.map((verb) => ({
    id: verb.verb,
    label: verb.label,
    tone: "ghost",
    reason: verb.reason,
    onPress: verb.press,
    ...(verb.question !== undefined && { question: verb.question }),
  }));
  verbs.push({
    id: "forward",
    label: "Preview →",
    tone: "filled",
    reason: previewIndexReason(ticked.length),
    onPress: () => {
      if (only !== undefined) openPreview(only);
    },
  });

  return (
    <>
      <ToolbarStrip label="Channels toolbar" verbs={verbs} />
      <BulkNotes notes={bulk.notes} onDismiss={bulk.dismiss} />
    </>
  );
}
