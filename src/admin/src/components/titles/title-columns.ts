import { createElement } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { recordFeatures } from "@giga/ui/lib/record-columns";
import { titleRow } from "@/lib/title-rows";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { TitleStateCell } from "./TitleStateCell";

const column = createColumnHelper<typeof recordFeatures, AdminTitleRow>();

/** The Titles lists' columns (`37` section 4.2, `45` section 2.3), the same for `Stored` and `Browse TMDB`: title, kind,
 *  year, rating, state. `size` is the minimum width in px. Hidden in a narrow pane in this order: rating, year, kind; the
 *  title and the state word always stay. The order is the server's or TMDB's (the toolbar's Sort), so no heading sorts. */
export const titleColumns = column.columns([
  column.accessor((row) => row.title, {
    id: "title",
    header: "title",
    size: 160,
    enableSorting: false,
    meta: { kind: "name", grow: 2, priority: 0 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => titleRow(row).kind, {
    id: "kind",
    header: "kind",
    size: 72,
    enableSorting: false,
    meta: { kind: "text", priority: 1 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => titleRow(row).year, {
    id: "year",
    header: "year",
    size: 56,
    enableSorting: false,
    meta: { kind: "number", priority: 2 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => titleRow(row).rating, {
    id: "rating",
    header: "rating",
    size: 64,
    enableSorting: false,
    meta: { kind: "number", priority: 3 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => titleRow(row).state.word, {
    id: "state",
    header: "state",
    size: 96,
    enableSorting: false,
    meta: { kind: "state", priority: 0 },
    cell: (info) => createElement(TitleStateCell, { title: info.row.original }),
  }),
]);
