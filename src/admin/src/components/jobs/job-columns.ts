import { createElement } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { recordFeatures } from "@giga/ui/lib/record-columns";
import type { JobRowView } from "@/lib/job-rows";
import { JobStateCell } from "./JobStateCell";

const column = createColumnHelper<typeof recordFeatures, JobRowView>();

/** The Jobs list's columns (`38` section 4.2, `45` section 2.3): name, type, target, schedule, last run, outcome, state.
 *  `size` is the minimum width in px. Hidden in a narrow pane in this order: last run, outcome, schedule, target, type;
 *  the name and the state cell always stay. The state cell holds the word and, while a job runs, the pulsing 48px bar
 *  beside it (the progress of `44` lands in this cell later); the elastic text columns end in an ellipsis with their
 *  full text as a tooltip. */
export const jobColumns = column.columns([
  column.accessor((row) => row.name, {
    id: "name",
    header: "name",
    size: 144,
    sortFn: "alphanumeric",
    meta: { kind: "name", grow: 1.3, priority: 0 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => row.type, {
    id: "type",
    header: "type",
    size: 80,
    sortFn: "alphanumeric",
    meta: { kind: "text", priority: 1 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => row.target, {
    id: "target",
    header: "target",
    size: 104,
    sortFn: "alphanumeric",
    meta: { kind: "text", grow: 1, priority: 2 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => row.schedule, {
    id: "schedule",
    header: "schedule",
    size: 128,
    enableSorting: false,
    meta: { kind: "text", priority: 3 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => row.lastRun, {
    id: "last-run",
    header: "last run",
    size: 144,
    sortFn: "alphanumeric",
    meta: { kind: "mono", priority: 5 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => row.outcome, {
    id: "outcome",
    header: "outcome",
    size: 112,
    enableSorting: false,
    meta: { kind: "mono", grow: 1.4, priority: 4 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => row.state.word, {
    id: "state",
    header: "state",
    size: 128,
    sortFn: "alphanumeric",
    meta: { kind: "custom", priority: 0 },
    cell: (info) => createElement(JobStateCell, { state: info.row.original.state }),
  }),
]);
