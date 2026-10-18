import { createElement } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { recordFeatures, type RecordColumns } from "@giga/ui/lib/record-columns";
import { browseStateOf } from "@/lib/title-browse";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { TitleBrowseStateCell } from "./TitleBrowseStateCell";
import { titleColumns } from "./title-columns";

const column = createColumnHelper<typeof recordFeatures, AdminTitleRow>();

const browseState = column.columns([
  column.accessor((row) => browseStateOf(row)?.word, {
    id: "state",
    header: "state",
    size: 96,
    enableSorting: false,
    meta: { kind: "state", priority: 0 },
    cell: (info) => createElement(TitleBrowseStateCell, { title: info.row.original }),
  }),
]);

/** The Browse TMDB list's columns (`docs/47` section 4): the Stored list's title, kind, year and rating, then a `state`
 *  column that holds `stored` or `deleted` (or nothing) in place of `synced` / `edited` / `manual` / `disabled`, which
 *  say nothing about a title the store may not hold. Same priorities: only the title and the state always stay. */
export const titleBrowseColumns: RecordColumns<AdminTitleRow> = [
  ...titleColumns.filter((one) => one.id !== "state"),
  ...browseState,
];
