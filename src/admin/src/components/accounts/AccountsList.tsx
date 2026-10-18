import { Users } from "lucide-react";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/account-copy";
import { useAccountActions } from "@/hooks/useAccountActions";
import { useAccountBulk } from "@/hooks/useAccountBulk";
import { useAppStore } from "@/store/app-store";
import { AccountRows } from "./AccountRows";

/** `Accounts`: the list group. Its table strip holds `Refresh` (it reads the accounts and the audit tail together,
 *  disabled with `Loading.` while a read runs) and, once rows are ticked, the count, `Enable`, `Disable`, the armed
 *  `Delete` and `Clear selection`. The heading carries nothing. */
export function AccountsList() {
  const loading = useAppStore((state) => state.accounts.status === "loading");
  const ticked = useAppStore((state) => state.accounts.ticked);
  const setTicked = useAppStore((state) => state.accountsSetTicked);
  const { flows, track } = useAccountActions();
  const { verbs } = useAccountBulk();
  const strip = (
    <TableStrip
      label="Accounts table"
      noun="accounts"
      refresh={{ onPress: () => void track("refresh", flows.refresh), reason: loading ? LOADING_REASON : undefined }}
      selection={{ count: ticked.length, verbs, onClear: () => setTicked([]) }}
    />
  );

  return (
    <ListGroup id="accounts-list" icon={Users} title="Accounts" strip={strip}>
      <AccountRows />
    </ListGroup>
  );
}
