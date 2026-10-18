import { createElement } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { recordFeatures } from "@giga/ui/lib/record-columns";
import { StateWord } from "@/components/records/StateWord";
import { countValue } from "@/lib/count-value";
import type { PlaylistRowView } from "@/lib/playlist-rows";

const column = createColumnHelper<typeof recordFeatures, PlaylistRowView>();

/** The Playlists list's columns (`43` section 4.1, `45` section 2.3): name, source (the host or the file name), the four
 *  counts, last run, state. `size` is the minimum width in px. Hidden in a narrow pane in this order: offline, online,
 *  enabled, source, last run, channels; the name and the state word always stay. A count sorts by its value. */
export const playlistColumns = column.columns([
  column.accessor((row) => row.name, {
    id: "name",
    header: "name",
    size: 128,
    sortFn: "alphanumeric",
    meta: { kind: "name", grow: 1.4, priority: 0 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => row.source, {
    id: "source",
    header: "source",
    size: 128,
    sortFn: "alphanumeric",
    meta: { kind: "mono", grow: 1, priority: 3 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => countValue(row.channels), {
    id: "channels",
    header: "channels",
    size: 88,
    sortFn: "basic",
    meta: { kind: "number", priority: 1 },
    cell: (info) => info.row.original.channels,
  }),
  column.accessor((row) => countValue(row.enabled), {
    id: "enabled",
    header: "enabled",
    size: 80,
    sortFn: "basic",
    meta: { kind: "number", priority: 4 },
    cell: (info) => info.row.original.enabled,
  }),
  column.accessor((row) => countValue(row.online), {
    id: "online",
    header: "online",
    size: 64,
    sortFn: "basic",
    meta: { kind: "number", priority: 5 },
    cell: (info) => info.row.original.online,
  }),
  column.accessor((row) => countValue(row.offline), {
    id: "offline",
    header: "offline",
    size: 64,
    sortFn: "basic",
    meta: { kind: "number", priority: 6 },
    cell: (info) => info.row.original.offline,
  }),
  column.accessor((row) => row.lastRun, {
    id: "last-run",
    header: "last run",
    size: 152,
    sortFn: "alphanumeric",
    meta: { kind: "mono", priority: 2 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => row.state.word, {
    id: "state",
    header: "state",
    size: 88,
    sortFn: "alphanumeric",
    meta: { kind: "state", priority: 0 },
    cell: (info) => createElement(StateWord, { state: info.row.original.state }),
  }),
]);
