import { Workspace } from "@giga/ui/form/Workspace";
import { IndexToolbar } from "@/components/records/IndexToolbar";
import { NEW_ACCOUNT_LABELS } from "@/constants/account-copy";
import { AccountsList } from "./AccountsList";
import { NewAccountForm } from "./NewAccountForm";

/** The Accounts index: the page toolbar, empty (Accounts has no forward verb), over `New account` and the list, whose
 *  first row holds the bulk verbs. */
export function AccountsIndex() {
  return (
    <>
      <IndexToolbar />
      <Workspace labels={NEW_ACCOUNT_LABELS} fill>
        <NewAccountForm />
        <AccountsList />
      </Workspace>
    </>
  );
}
