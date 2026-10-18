import { RecordGrid } from "@giga/ui/lists/RecordGrid";
import { SkeletonGrid } from "@giga/ui/lists/SkeletonGrid";
import { CHANNEL_GRID, CHANNEL_HEADINGS } from "@/constants/channel-grid";
import { useChannelActions } from "@/hooks/useChannelActions";
import { writeReason } from "@/lib/channel-check";
import { isTicked } from "@/lib/channel-list";
import { channelRows } from "@/lib/channel-rows";
import { useAppStore } from "@/store/app-store";
import { ChannelRow } from "./ChannelRow";

/** The channels grid: the header (its tick cell empty: select-all is the toolbar's `All`), and a row for each channel, by name. Shimmer rows in the
 *  header's own columns draw while nothing has been read yet and when there is nothing to list (never a sentence, never
 *  an empty card); a refresh keeps the rows it has, and so does a failed read. */
export function ChannelRows() {
  const { status, items, ticked, unreachable } = useAppStore((state) => state.channels);
  const tick = useAppStore((state) => state.channelTick);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const { flows, saving, isBusy, track } = useChannelActions();
  const waiting = items.length === 0 || status === "idle";

  return (
    <RecordGrid
      ariaLabel="Channels"
      layout={CHANNEL_GRID}
      headings={CHANNEL_HEADINGS}
      ticks
    >
      {waiting ? (
        <SkeletonGrid />
      ) : (
        channelRows(items).map((row) => (
          <ChannelRow
            key={row.id}
            row={row}
            ticked={isTicked(ticked, row.id)}
            deleteReason={writeReason({ saving: saving || isBusy(`delete:${row.id}`), unreachable })}
            onTick={tick}
            onOpen={(id) => openWorkspace("channels", id)}
            onDelete={(id) => void track(`delete:${id}`, () => flows.remove(id))}
          />
        ))
      )}
    </RecordGrid>
  );
}
