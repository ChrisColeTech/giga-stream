import { RefreshCw, Users } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/account-copy";
import { useAccountActions } from "@/hooks/useAccountActions";
import { useAppStore } from "@/store/app-store";
import { AccountRows } from "./AccountRows";

/** `Accounts`: the list group with a ghost `Refresh` in the heading, which reads the accounts and the audit tail together.
 *  It is disabled with `Loading.` while a read runs. */
export function AccountsList() {
  const loading = useAppStore((state) => state.accounts.status === "loading");
  const { flows, track } = useAccountActions();
  const refresh = (
    <Button
      variant="ghost"
      size="sm"
      reason={loading ? LOADING_REASON : undefined}
      onClick={() => void track("refresh", flows.refresh)}
    >
      <RefreshCw aria-hidden /> Refresh
    </Button>
  );

  return (
    <ListGroup id="accounts-list" icon={Users} title="Accounts" action={refresh}>
      <AccountRows />
    </ListGroup>
  );
}
