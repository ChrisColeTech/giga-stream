import { ArmedButton } from "@giga/ui/controls/ArmedButton";
import { RecordTable } from "@giga/ui/lists/RecordTable";
import type { RecordRowView } from "@giga/ui/lists/record-table-types";
import { DELETE_TITLE } from "@/constants/account-copy";
import { useAccountActions } from "@/hooks/useAccountActions";
import { deleteReason } from "@/lib/account-guard";
import { useAccountView } from "@/hooks/useAccountView";
import { isTicked, type AccountRowView } from "@/lib/account-rows";
import { useAppStore } from "@/store/app-store";
import { accountColumns } from "./account-columns";

const idOf = (row: AccountRowView): string => String(row.id);

/** The accounts table: a row for each account (the username, the kind (`62` section 3.7), the state word, the last
 *  sign-in in mono, `never` if it has not signed in) and the end `Delete`, an armed two-step naming who dies
 *  (`Delete ed@example.test?`). A disabled account stays in the list, dimmed. Skeleton rows in the same columns draw
 *  while nothing has been read yet and when there is nothing to list (never a sentence); a refresh keeps the rows it
 *  has, and so does a failed read. */
export function AccountRows() {
  const { status, items, ticked, unreachable } = useAppStore((state) => state.accounts);
  const tick = useAppStore((state) => state.accountTick);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const { flows, saving, isBusy, track } = useAccountActions();
  const { visible, sort } = useAccountView();
  const waiting = items.length === 0 || status === "idle";

  const rowView = (row: AccountRowView): RecordRowView => {
    const account = items.find((item) => idOf(row) === String(item.id));
    const reason = account === undefined ? undefined : deleteReason(items, account, { unreachable, busy: saving || isBusy(`delete:${idOf(row)}`) });
    return {
      state: row.state.word,
      dimmed: row.state.dimmed,
      ticked: isTicked(ticked, row.id),
      tick: { label: `Select ${row.username}`, onToggle: (on) => tick(row.id, on) },
      onOpen: () => openWorkspace("accounts", idOf(row)),
      end: (
        <ArmedButton
          question={`Delete ${row.username}?`}
          disabled={reason !== undefined}
          title={reason ?? DELETE_TITLE}
          onConfirm={() => void track(`delete:${idOf(row)}`, () => flows.remove(row.id))}
        >
          Delete
        </ArmedButton>
      ),
    };
  };

  return (
    <RecordTable
      ariaLabel="Accounts"
      columns={accountColumns}
      rows={visible}
      idOf={idOf}
      rowView={rowView}
      waiting={waiting}
      sort={sort}
    />
  );
}
