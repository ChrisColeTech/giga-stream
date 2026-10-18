import { Users } from "lucide-react";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/account-copy";
import { useAccountActions } from "@/hooks/useAccountActions";
import { useAccountBulk } from "@/hooks/useAccountBulk";
import { selectAllState } from "@/lib/account-rows";
import { useAppStore } from "@/store/app-store";
import { AccountRows } from "./AccountRows";

/** `Accounts`: the list group. Its selection toolbar (`01` section 9) holds `Refresh` (it reads the accounts and the audit
 *  tail together, disabled with `Loading.` while a read runs), then `Enable`, `Disable` and the armed `Delete`, always
 *  drawn and disabled with their reason until a row is ticked, and the three-state `All` on the right. */
export function AccountsList() {
  const { status, items, ticked } = useAppStore((state) => state.accounts);
  const tickAll = useAppStore((state) => state.accountsTickAll);
  const { flows, track } = useAccountActions();
  const { verbs } = useAccountBulk();
  const reason = status === "loading" ? LOADING_REASON : undefined;
  const all = {
    label: "Select all accounts",
    checked: selectAllState(items, ticked),
    onToggle: tickAll,
    disabled: items.length === 0,
  };
  const strip = (
    <TableStrip
      label="Accounts table"
      noun="accounts"
      refresh={{ onPress: () => void track("refresh", flows.refresh), reason }}
      selection={{ verbs }}
    />
  );

  return (
    <ListGroup id="accounts-list" icon={Users} title="Accounts" strip={strip} all={all} fill>
      <AccountRows />
    </ListGroup>
  );
}
