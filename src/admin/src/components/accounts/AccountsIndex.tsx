import { Workspace } from "@giga/ui/form/Workspace";
import { NEW_ACCOUNT_LABELS } from "@/constants/account-copy";
import { AccountsList } from "./AccountsList";
import { NewAccountForm } from "./NewAccountForm";

/** The Accounts index: `New account` and the list, whose table strip holds the bulk verbs. No page toolbar. */
export function AccountsIndex() {
  return (
    <Workspace labels={NEW_ACCOUNT_LABELS}>
      <NewAccountForm />
      <AccountsList />
    </Workspace>
  );
}
