import { Radio } from "lucide-react";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/channel-copy";
import { useChannelActions } from "@/hooks/useChannelActions";
import type { ChannelBulk } from "@/hooks/useChannelBulk";
import { useForwardVerbs } from "@/hooks/useForwardVerbs";
import { useAppStore } from "@/store/app-store";
import { ChannelRows } from "./ChannelRows";

/** `Channels`: the list group. Its table strip holds `Refresh` (it reads `GET /api/admin-channels` again and replaces
 *  the list: the only way a `preparing` row is seen `live`, since nothing polls; disabled with `Loading.` while a read
 *  runs) and, once rows are ticked, the count, `Enable`, `Disable`, `Rebuild`, the armed `Delete` and `Clear selection`.
 *  What a run could not do is Events rows, not a list. */
export function ChannelsList({ bulk }: { readonly bulk: ChannelBulk }) {
  const loading = useAppStore((state) => state.channels.status === "loading");
  const ticked = useAppStore((state) => state.channels.ticked);
  const setTicked = useAppStore((state) => state.channelsSetTicked);
  const { flows, track } = useChannelActions();
  const forward = useForwardVerbs("channels");
  const strip = (
    <TableStrip
      label="Channels table"
      noun="channels"
      forward={forward}
      refresh={{ onPress: () => void track("refresh", flows.refresh), reason: loading ? LOADING_REASON : undefined }}
      selection={{ count: ticked.length, verbs: bulk.verbs, onClear: () => setTicked([]) }}
    />
  );

  return (
    <ListGroup id="ch-list" icon={Radio} title="Channels" strip={strip}>
      <ChannelRows />
    </ListGroup>
  );
}
