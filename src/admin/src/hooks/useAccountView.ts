import { useMemo } from "react";
import { accountRow, type AccountRowView } from "@/lib/account-rows";
import { accountSpec } from "@/lib/list-specs";
import { useAppStore } from "@/store/app-store";
import { useListQuery, type ListQueryView } from "./useListQuery";

const idOf = (row: AccountRowView): string => String(row.id);

function retain(keep: (id: string) => boolean): void {
  const state = useAppStore.getState();
  state.accountsSetTicked(state.accounts.ticked.filter((id) => keep(String(id))));
}

/** The Accounts list as the query shows it: every account's row, filtered and sorted (`lib/list-query.ts`). */
export function useAccountView(): ListQueryView<AccountRowView> {
  const items = useAppStore((state) => state.accounts.items);
  const rows = useMemo(() => items.map(accountRow), [items]);
  return useListQuery({ list: "accounts", rows, spec: accountSpec, idOf, retain });
}
