import { Workspace } from "@giga/ui/form/Workspace";
import { NEW_ACCOUNT_LABELS } from "@/constants/account-copy";
import { IndexToolbar } from "@/components/records/IndexToolbar";
import { INDEX_FRAMES } from "@/constants/index-frames";
import { AccountsList } from "./AccountsList";
import { NewAccountForm } from "./NewAccountForm";

/** The Accounts index: the (empty) page toolbar over `New account` and the list, whose table strip holds the bulk verbs. */
export function AccountsIndex() {
  return (
    <>
      <IndexToolbar frame={INDEX_FRAMES.accounts} />
      <Workspace labels={NEW_ACCOUNT_LABELS}>
        <NewAccountForm />
        <AccountsList />
      </Workspace>
    </>
  );
}
