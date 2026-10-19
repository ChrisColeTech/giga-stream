import { createElement } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { recordFeatures } from "@giga/ui/lib/record-columns";
import { CELL_NAME } from "@giga/ui/lists/record-grid-classes";
import { HEADING_DURATION, HEADING_NAME, HEADING_NUMBER } from "@/constants/channel-copy";
import { formatDuration } from "@/lib/live-time";
import type { PlaylistEntry } from "@/types/admin-channel";

/** One playlist entry as its table reads it: its place in the play order (the `#` cell and the row's id), the entry
 *  itself, and whether it is the one on air (the row's `state: "playing"` and the accent name cell). */
export interface PlaylistEntryRow {
  readonly position: number;
  readonly entry: PlaylistEntry;
  readonly onAir: boolean;
}

const column = createColumnHelper<typeof recordFeatures, PlaylistEntryRow>();

/** The entry on air keeps the name cell's shape but draws in the accent (`52` decision 2: the marker is the state). */
const ACCENT_NAME = "h-9 truncate leading-9 font-medium text-accent-text";

/** The live workspace's playlist table (`52` decision 2): the play order's number, the name, the `mm:ss` - exactly what
 *  each row shows today. Nothing sorts: play order is the order, so the headings are not buttons. The name is a custom
 *  cell so the entry on air can style itself; `duration` hides first in a narrow pane, the number and the name never. */
export const playlistEntryColumns = column.columns([
  column.accessor((row) => row.position + 1, {
    id: "position",
    header: HEADING_NUMBER,
    size: 48,
    enableSorting: false,
    meta: { kind: "number", priority: 0 },
    cell: (info) => String(info.getValue()),
  }),
  column.accessor((row) => row.entry.name, {
    id: "name",
    header: HEADING_NAME,
    size: 200,
    enableSorting: false,
    meta: { kind: "custom", grow: 1, priority: 0 },
    cell: (info) => {
      const row = info.row.original;
      return createElement(
        "span",
        { className: row.onAir ? ACCENT_NAME : CELL_NAME, title: row.entry.name },
        row.entry.name,
      );
    },
  }),
  column.accessor((row) => formatDuration(row.entry.durationMs), {
    id: "duration",
    header: HEADING_DURATION,
    size: 72,
    enableSorting: false,
    meta: { kind: "mono", priority: 1 },
    cell: (info) => info.getValue(),
  }),
]);
