import { RecordGrid } from "@giga/ui/lists/RecordGrid";
import { SkeletonGrid } from "@giga/ui/lists/SkeletonGrid";
import { ACCOUNT_GRID, ACCOUNT_HEADINGS } from "@/constants/account-grid";
import { useAccountActions } from "@/hooks/useAccountActions";
import { deleteReason } from "@/lib/account-guard";
import { accountRow, isTicked, selectAllState } from "@/lib/account-rows";
import { useAppStore } from "@/store/app-store";
import type { AccountId } from "@/types/admin-account";
import { AccountRow } from "./AccountRow";

/** The accounts grid: the header with its select-all tick, and a row for each account. Shimmer rows in the header's own
 *  columns draw while nothing has been read yet and when there is nothing to list (never a sentence, never an empty card);
 *  a refresh keeps the rows it has. A failed read keeps the last rows too. */
export function AccountRows() {
  const { status, items, ticked, unreachable } = useAppStore((state) => state.accounts);
  const tick = useAppStore((state) => state.accountTick);
  const tickAll = useAppStore((state) => state.accountsTickAll);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const { flows, saving, isBusy, track } = useAccountActions();
  const waiting = items.length === 0 || status === "idle";

  return (
    <RecordGrid
      ariaLabel="Accounts"
      layout={ACCOUNT_GRID}
      headings={ACCOUNT_HEADINGS}
      selection={{ label: "Select all accounts", checked: selectAllState(items, ticked), onToggle: tickAll }}
    >
      {waiting ? (
        <SkeletonGrid />
      ) : (
        items.map((account) => (
          <AccountRow
            key={String(account.id)}
            row={accountRow(account)}
            ticked={isTicked(ticked, account.id)}
            deleteReason={deleteReason(items, account, { unreachable, busy: saving || isBusy(`delete:${String(account.id)}`) })}
            onTick={tick}
            onOpen={(id: AccountId) => openWorkspace("accounts", String(id))}
            onDelete={(id) => void track(`delete:${String(id)}`, () => flows.remove(id))}
          />
        ))
      )}
    </RecordGrid>
  );
}
