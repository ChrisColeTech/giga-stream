import { AccountsIndex } from "@/components/accounts/AccountsIndex";
import { AccountWorkspace } from "@/components/accounts/AccountWorkspace";
import { TabPage, type PageProps } from "@/components/chrome/TabPage";
import { useAccountsLoad } from "@/hooks/useAccountsLoad";
import { useAppStore } from "@/store/app-store";

/** Accounts: the index (bulk toolbar, `New account`, the list) or, when a row is open, that account's workspace. The page
 *  is the only reader of `workspaces.accounts`. It loads the accounts when first shown after sign-in. */
export function AccountsPage({ active }: PageProps) {
  const openId = useAppStore((state) => state.workspaces.accounts);
  useAccountsLoad(active);
  return (
    <TabPage active={active} label="Accounts">
      {openId === null ? <AccountsIndex /> : <AccountWorkspace id={openId} active={active} />}
    </TabPage>
  );
}
