import { createElement } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { recordFeatures } from "@giga/ui/lib/record-columns";
import { StateWord } from "@/components/records/StateWord";
import { channelRow } from "@/lib/channel-rows";
import type { AdminChannel } from "@/types/admin-channel";

const column = createColumnHelper<typeof recordFeatures, AdminChannel>();

/** The Channels list's columns (`36` section 5.2, `45` section 2.3): name, category, kind, state, stream (the sync's
 *  verdict on a stream row's address: `online`, `offline`, `not checked`; blank on a live channel), mode, now playing.
 *  `size` is the minimum width in px. Hidden in a narrow pane in this order: now playing, mode, category, kind, stream;
 *  the name and the state word always stay. Name, category and kind sort on the server (the header and the Sort select
 *  agree); the others do not. */
export const channelColumns = column.columns([
  column.accessor((row) => row.name, {
    id: "name",
    header: "name",
    size: 144,
    meta: { kind: "name", grow: 1.4, priority: 0 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => row.category, {
    id: "category",
    header: "category",
    size: 112,
    meta: { kind: "text", priority: 3 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => channelRow(row).kind, {
    id: "kind",
    header: "kind",
    size: 64,
    meta: { kind: "text", priority: 2 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => channelRow(row).state.word, {
    id: "state",
    header: "state",
    size: 96,
    enableSorting: false,
    meta: { kind: "state", priority: 0 },
    cell: (info) => createElement(StateWord, { state: channelRow(info.row.original).state }),
  }),
  column.accessor((row) => channelRow(row).stream?.word ?? "", {
    id: "stream",
    header: "stream",
    size: 96,
    enableSorting: false,
    meta: { kind: "state", priority: 1 },
    cell: (info) => {
      const stream = channelRow(info.row.original).stream;
      return stream === null ? null : createElement(StateWord, { state: stream });
    },
  }),
  column.accessor((row) => channelRow(row).mode, {
    id: "mode",
    header: "mode",
    size: 72,
    enableSorting: false,
    meta: { kind: "text", priority: 4 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => channelRow(row).nowPlaying, {
    id: "now-playing",
    header: "now playing",
    size: 128,
    enableSorting: false,
    meta: { kind: "text", grow: 1.2, priority: 5 },
    cell: (info) => info.getValue(),
  }),
]);
