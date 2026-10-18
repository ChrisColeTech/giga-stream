import { createColumnHelper } from "@tanstack/react-table";
import { recordFeatures } from "@giga/ui/lib/record-columns";
import type { DeletedRowView } from "@/lib/title-restore";

const column = createColumnHelper<typeof recordFeatures, DeletedRowView>();

/** The Deleted titles list's columns (`37` section 4.4, `45` section 2.3): the name, the kind, when it was deleted. `size`
 *  is the minimum width in px. Hidden in a narrow pane in this order: kind, deleted; the name always stays. Nothing sorts:
 *  the order is the backend's. */
export const deletedTitleColumns = column.columns([
  column.accessor((row) => row.name, {
    id: "name",
    header: "name",
    size: 160,
    enableSorting: false,
    meta: { kind: "name", grow: 2, priority: 0 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => row.kind, {
    id: "kind",
    header: "kind",
    size: 72,
    enableSorting: false,
    meta: { kind: "text", priority: 2 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => row.when, {
    id: "deleted",
    header: "deleted",
    size: 144,
    enableSorting: false,
    meta: { kind: "mono", priority: 1 },
    cell: (info) => info.getValue(),
  }),
]);
