import { useCallback, useEffect, useMemo } from "react";
import { PAGE_SIZE, WINDOW_MIN_ROWS } from "@giga/ui/lib/window-constants";
import { WindowedRecordGrid } from "@giga/ui/lists/WindowedRecordGrid";
import { CHANNEL_GRID, CHANNEL_HEADINGS } from "@/constants/channel-grid";
import { useChannelActions } from "@/hooks/useChannelActions";
import { writeReason } from "@/lib/channel-check";
import { channelRow } from "@/lib/channel-rows";
import { rowAt } from "@/lib/channel-pages";
import { pressHeading, queryKey } from "@/lib/channel-query";
import { useAppStore } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";
import { ChannelRow } from "./ChannelRow";

const idOf = (channel: AdminChannel): string => channel.id;

/** The channels grid (`41` section 4.2): the shared windowed record grid over the PAGED list. At or under 100 rows it is
 *  the plain grid, as it always was; above, it owns a scroller and mounts only the rows near the viewport, asking for
 *  the pages the window shows. A row whose page is not loaded is a shimmer row in the header's own columns; nothing
 *  read yet, or nothing to list, is the shimmer grid (never a sentence). The header's tick cell is empty: select-all is
 *  the strip's `All`. A refresh drops the pages and the window reads what it shows again; a failed read keeps the rows. */
export function ChannelRows() {
  const { status, query, total, pages, ticked, unreachable } = useAppStore((state) => state.channels);
  const tick = useAppStore((state) => state.channelTick);
  const remember = useAppStore((state) => state.channelRemember);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const { flows, saving, isBusy, track } = useChannelActions();
  const key = queryKey(query);
  const count = total ?? 0;

  const at = useCallback((index: number) => rowAt(pages, index), [pages]);
  const selection = useMemo(() => ({ mode: "ids" as const, ids: new Set(ticked) }), [ticked]);
  const need = useCallback(
    (first: number) => {
      void flows.readPage(Math.floor(first / PAGE_SIZE));
      return true;
    },
    [flows],
  );

  // A list the plain grid draws has no window to ask for its page: when its rows are gone (a create, a delete) the
  // page is read here. A failed read leaves the status `failed`, so it is not asked again until Refresh.
  const rowsMissing = status === "ready" && count > 0 && count <= WINDOW_MIN_ROWS && at(0) === undefined;
  useEffect(() => {
    if (rowsMissing) void flows.readPage(0);
  }, [rowsMissing, flows]);

  return (
    <WindowedRecordGrid
      ariaLabel="Channels"
      layout={CHANNEL_GRID}
      headings={CHANNEL_HEADINGS}
      total={count}
      rowAt={at}
      idOf={idOf}
      selection={selection}
      resetKey={key}
      onNeedRange={need}
      sort={
        count > WINDOW_MIN_ROWS
          ? {
              state: { key: query.sort, dir: query.dir },
              onSort: (heading) => void flows.setQuery(pressHeading(query, heading)),
            }
          : undefined
      }
      renderRow={(channel, _index, isOn) => (
        <ChannelRow
          row={channelRow(channel)}
          ticked={isOn}
          deleteReason={writeReason({ saving: saving || isBusy(`delete:${channel.id}`), unreachable })}
          onTick={tick}
          onOpen={(id) => {
            remember(channel);
            openWorkspace("channels", id);
          }}
          onDelete={(id) => void track(`delete:${id}`, () => flows.remove(id))}
        />
      )}
    />
  );
}
