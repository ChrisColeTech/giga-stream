import { createElement } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { recordFeatures } from "@giga/ui/lib/record-columns";
import { StateWord } from "@/components/records/StateWord";
import type { AccountRowView } from "@/lib/account-rows";

const column = createColumnHelper<typeof recordFeatures, AccountRowView>();

/* THE SLOT FOR THE ID COLUMN. Accounts will get a generated integer id from a backend sequence (migration 018); the column
 * lands in a follow-up after that backend work merges, as a column here reading the id the backend sends (`AccountId`,
 * `types/admin-account.ts`). The client never derives or invents an id, so until then the list has no such column. */

/** The Accounts list's columns (`35` section 5.8, `45` section 2.3): username, state, last sign-in, which is hidden first
 *  in a narrow pane and holds the 16 mono characters of `formatWhen` whole (152px). */
export const accountColumns = column.columns([
  column.accessor((row) => row.username, {
    id: "username",
    header: "username",
    size: 192,
    sortFn: "alphanumeric",
    meta: { kind: "name", grow: 1.6, priority: 0 },
    cell: (info) => info.getValue(),
  }),
  column.accessor((row) => row.state.word, {
    id: "state",
    header: "state",
    size: 112,
    sortFn: "alphanumeric",
    meta: { kind: "state", priority: 0 },
    cell: (info) => createElement(StateWord, { state: info.row.original.state }),
  }),
  column.accessor((row) => row.when, {
    id: "last-sign-in",
    header: "last sign-in",
    size: 152,
    sortFn: "alphanumeric",
    meta: { kind: "mono", grow: 1, priority: 1 },
    cell: (info) => info.getValue(),
  }),
]);
