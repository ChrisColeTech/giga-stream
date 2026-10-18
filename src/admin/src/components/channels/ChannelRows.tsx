import { createElement, useCallback, useEffect, useMemo } from "react";
import { PAGE_SIZE, WINDOW_MIN_ROWS, END_ACTIONS_PX } from "@giga/ui/lib/window-constants";
import { RecordTable } from "@giga/ui/lists/RecordTable";
import type { RecordRowView } from "@giga/ui/lists/record-table-types";
import { UNREACHABLE_REASON } from "@/constants/channel-copy";
import { useChannelActions } from "@/hooks/useChannelActions";
import { usePreviewOpen } from "@/hooks/usePreviewOpen";
import { writeReason } from "@/lib/channel-check";
import { channelRow } from "@/lib/channel-rows";
import { rowAt } from "@/lib/channel-pages";
import { pressHeading, queryKey } from "@/lib/channel-query";
import { useAppStore } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";
import { ChannelActions } from "./ChannelActions";
import { channelColumns } from "./channel-columns";

const idOf = (channel: AdminChannel): string => channel.id;

/** The channels table (`41` section 4.2, `45`): a `RecordTable` over the PAGED list. At or under 100 rows every row is
 *  mapped; above, it mounts only the rows near the viewport, asking for the pages the window shows. A row whose page is
 *  not loaded is a skeleton row in the header's own columns; nothing read yet, or nothing to list, is the skeleton rows
 *  (never a sentence). The header's `All` is the selection's; its sortable headings are the server's sort. A refresh drops
 *  the pages and the window reads what it shows again; a failed read keeps the rows. Each row ends with `Preview` and the
 *  armed `Delete`. */
export function ChannelRows() {
  const { status, query, total, pages, ticked, unreachable } = useAppStore((state) => state.channels);
  const tick = useAppStore((state) => state.channelTick);
  const remember = useAppStore((state) => state.channelRemember);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const { flows, saving, isBusy, track } = useChannelActions();
  const openPreview = usePreviewOpen();
  const key = queryKey(query);
  const count = total ?? 0;

  const at = useCallback((index: number) => rowAt(pages, index), [pages]);
  const tickedIds = useMemo(() => new Set(ticked), [ticked]);
  const need = useCallback(
    (first: number) => {
      void flows.readPage(Math.floor(first / PAGE_SIZE));
      return true;
    },
    [flows],
  );

  // A list that is not windowed has no window to ask for its page: when its rows are gone (a create, a delete) the page
  // is read here. A failed read leaves the status `failed`, so it is not asked again until Refresh.
  const rowsMissing = status === "ready" && count > 0 && count <= WINDOW_MIN_ROWS && at(0) === undefined;
  useEffect(() => {
    if (rowsMissing) void flows.readPage(0);
  }, [rowsMissing, flows]);

  const rowView = (channel: AdminChannel): RecordRowView => {
    const row = channelRow(channel);
    return {
      state: row.state.word,
      dimmed: row.state.dimmed,
      ticked: tickedIds.has(channel.id),
      tick: { label: `Select ${row.name}`, onToggle: (on) => tick(channel.id, on) },
      onOpen: () => {
        remember(channel);
        openWorkspace("channels", channel.id);
      },
      end: createElement(ChannelActions, {
        row,
        deleteReason: writeReason({ saving: saving || isBusy(`delete:${channel.id}`), unreachable }),
        previewReason: unreachable ? UNREACHABLE_REASON : undefined,
        onPreview: openPreview,
        onDelete: (id) => void track(`delete:${id}`, () => flows.remove(id)),
      }),
    };
  };

  return (
    <RecordTable<AdminChannel>
      ariaLabel="Channels"
      columns={channelColumns}
      paging={{ total: count, rowAt: at, resetKey: key, onNeedRange: need }}
      idOf={idOf}
      rowView={rowView}
      endPx={END_ACTIONS_PX}
      sort={{
        state: { key: query.sort, dir: query.dir },
        onSort: (heading) => void flows.setQuery(pressHeading(query, heading)),
      }}
    />
  );
}
