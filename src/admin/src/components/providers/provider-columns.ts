import { createElement } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { recordFeatures } from "@giga/ui/lib/record-columns";
import { StateWord } from "@/components/records/StateWord";
import type { ProviderRowView } from "@/lib/provider-rows";

const column = createColumnHelper<typeof recordFeatures, ProviderRowView>();

/** The Providers list's columns (`45` section 2.3). `size` is the minimum width in px. Hidden in a narrow pane in this
 *  order: order, host, family; the name and the state word always stay. */
export const providerColumns = column.columns([
  column.accessor((row) => Number(row.order), {
    id: "order",
    header: "order",
    size: 56,
    sortFn: "basic",
    meta: { kind: "number", priority: 3 },
    cell: (info) => info.row.original.order,
  }),
  column.accessor((row) => row.name, {
    id: "name",
    header: "name",
    size: 160,
    sortFn: "alphanumeric",
    meta: { kind: "name", grow: 1.4, priority: 0 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => row.host, {
    id: "host",
    header: "host",
    size: 112,
    sortFn: "alphanumeric",
    meta: { kind: "mono", grow: 1, priority: 2 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => row.family, {
    id: "family",
    header: "family",
    size: 96,
    sortFn: "alphanumeric",
    meta: { kind: "text", priority: 1 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => row.state.word, {
    id: "state",
    header: "state",
    size: 96,
    sortFn: "alphanumeric",
    meta: { kind: "state", priority: 0 },
    cell: (info) => createElement(StateWord, { state: info.row.original.state }),
  }),
]);
