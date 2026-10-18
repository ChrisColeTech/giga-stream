import { Radio } from "lucide-react";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/channel-copy";
import { useChannelActions } from "@/hooks/useChannelActions";
import type { ChannelBulk } from "@/hooks/useChannelBulk";
import { selectAllState } from "@/lib/channel-list";
import { useAppStore } from "@/store/app-store";
import { ChannelRows } from "./ChannelRows";

/** `Channels`: the list group. Its first row (`01` section 9) holds `Refresh` (it reads `GET /api/admin-channels`
 *  again and replaces the list: the only way a `preparing` row is seen `live`, since nothing polls; disabled with
 *  `Loading.` while a read runs), then `Enable`, `Disable`, `Rebuild` and the armed `Delete`, always drawn and disabled
 *  with their reason until a row is ticked; on the right the three-state `All`. `Preview →` is the page toolbar's. What
 *  a run could not do is Events rows, not a list. */
export function ChannelsList({ bulk }: { readonly bulk: ChannelBulk }) {
  const { status, items, ticked } = useAppStore((state) => state.channels);
  const tickAll = useAppStore((state) => state.channelsTickAll);
  const { flows, track } = useChannelActions();
  const reason = status === "loading" ? LOADING_REASON : undefined;
  const all = { label: "Select all channels", checked: selectAllState(items, ticked), onToggle: tickAll };
  const strip = (
    <TableStrip
      label="Channels table"
      noun="channels"
      refresh={{ onPress: () => void track("refresh", flows.refresh), reason }}
      selection={{ verbs: bulk.verbs, all: { ...all, disabled: items.length === 0 } }}
    />
  );

  return (
    <ListGroup id="ch-list" icon={Radio} title="Channels" strip={strip}>
      <ChannelRows />
    </ListGroup>
  );
}
