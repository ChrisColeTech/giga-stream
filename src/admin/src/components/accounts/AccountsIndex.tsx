import { Workspace } from "@giga/ui/form/Workspace";
import { NEW_ACCOUNT_LABELS } from "@/constants/account-copy";
import { AccountsList } from "./AccountsList";
import { AccountsToolbar } from "./AccountsToolbar";
import { NewAccountForm } from "./NewAccountForm";

/** The Accounts index: the bulk toolbar over `New account` and the list. */
export function AccountsIndex() {
  return (
    <>
      <AccountsToolbar />
      <Workspace labels={NEW_ACCOUNT_LABELS}>
        <NewAccountForm />
        <AccountsList />
      </Workspace>
    </>
  );
}
