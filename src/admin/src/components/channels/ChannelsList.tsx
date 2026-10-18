import { Radio } from "lucide-react";
import { loadedState, matchingOffer } from "@giga/ui/lib/list-selection";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/channel-copy";
import { QUERY_BUSY_REASON } from "@/constants/channel-query-copy";
import { useChannelActions } from "@/hooks/useChannelActions";
import type { ChannelBulk } from "@/hooks/useChannelBulk";
import { useAppStore } from "@/store/app-store";
import { ChannelQueryRow } from "./ChannelQueryRow";
import { ChannelRows } from "./ChannelRows";

/** `Channels`: the list group. Its first row (`01` section 9, LoRA Studio `LibraryToolbar`) opens with the search field,
 *  the Sort select and the Kind, State, Origin and Enabled selects, then `Refresh` (it drops the pages and the window
 *  reads what it shows again, keeping its place: the only way a `preparing` row is seen `live`, since nothing polls;
 *  disabled with `Loading.` while a read runs), then `Enable`, `Disable`, `Rebuild` and the armed `Delete`, always drawn
 *  and disabled with their reason until a row is ticked; on the right `Select all M matching` once every loaded row is
 *  ticked and the query holds more, and the three-state `All` over the rows loaded. `Preview →` is the page toolbar's.
 *  What a run could not do is Events rows, not a list. */
export function ChannelsList({ bulk }: { readonly bulk: ChannelBulk }) {
  const { status, query, total, items, ticked, resolving } = useAppStore((state) => state.channels);
  const tickAll = useAppStore((state) => state.channelsTickAll);
  const { flows, track } = useChannelActions();
  const reason = status === "loading" ? LOADING_REASON : undefined;
  const ids = items.map((item) => item.id);
  const selection = { mode: "ids" as const, ids: new Set(ticked) };
  const offer = ticked.length >= (total ?? 0) ? null : matchingOffer(selection, ids, total ?? 0);
  const strip = (
    <TableStrip
      label="Channels table"
      noun="channels"
      query={
        <ChannelQueryRow
          query={query}
          onQuery={(next) => void flows.setQuery(next)}
          reason={bulk.working ? QUERY_BUSY_REASON : undefined}
        />
      }
      refresh={{ onPress: () => void track("refresh", flows.refresh), reason }}
      selection={{
        verbs: bulk.verbs,
        all: {
          label: "Select all channels",
          checked: loadedState(selection, ids),
          onToggle: tickAll,
          disabled: ids.length === 0,
        },
        ...(offer !== null && {
          matching: {
            label: `Select all ${offer.toLocaleString("en-US")} matching`,
            onPress: () => void flows.selectMatching(),
            reason: resolving ? LOADING_REASON : bulk.working ? QUERY_BUSY_REASON : undefined,
          },
        }),
      }}
    />
  );

  return (
    <ListGroup id="ch-list" icon={Radio} title="Channels" strip={strip}>
      <ChannelRows />
    </ListGroup>
  );
}
