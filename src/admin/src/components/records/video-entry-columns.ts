import { createColumnHelper } from "@tanstack/react-table";
import { recordFeatures } from "@giga/ui/lib/record-columns";
import { HEADING_NUMBER, HEADING_PATH } from "@/constants/channel-copy";

/** One video as its table reads it: its place in the play order (the `#` cell and the row's id) and the path. */
export interface VideoEntryRow {
  readonly position: number;
  readonly path: string;
}

const column = createColumnHelper<typeof recordFeatures, VideoEntryRow>();

/** The live workspace's videos table (`52` decision 3): the play order's number and the path in mono. Nothing sorts:
 *  play order is the order, so the headings are not buttons. The path grows and never hides; the row's verbs (up, down,
 *  remove) live in the wider end column, not a column of their own. */
export const videoEntryColumns = column.columns([
  column.accessor((row) => row.position + 1, {
    id: "position",
    header: HEADING_NUMBER,
    size: 48,
    enableSorting: false,
    meta: { kind: "number", priority: 0 },
    cell: (info) => String(info.getValue()),
  }),
  column.accessor((row) => row.path, {
    id: "path",
    header: HEADING_PATH,
    size: 200,
    enableSorting: false,
    meta: { kind: "mono", grow: 1, priority: 0 },
    cell: (info) => info.getValue(),
  }),
]);
