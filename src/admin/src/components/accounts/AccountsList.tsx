import { Users } from "lucide-react";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/account-copy";
import { useAccountActions } from "@/hooks/useAccountActions";
import { useAccountBulk } from "@/hooks/useAccountBulk";
import { useAccountView } from "@/hooks/useAccountView";
import { LIST_BARS } from "@/constants/list-query-copy";
import { tickState } from "@/lib/list-query";
import { useAppStore } from "@/store/app-store";
import { ListQueryBar } from "@/components/records/ListQueryBar";
import { AccountRows } from "./AccountRows";

/** `Accounts`: the list group. Its first rows (`01` section 9) are the query row (search, Sort, State and Sign-in) and
 *  the selection toolbar: `Refresh` (it reads the accounts and the audit tail together, disabled with `Loading.` while a
 *  read runs), then `Enable`, `Disable` and the armed `Delete`, always drawn and disabled with their reason until a row
 *  is ticked; the three-state `All` ticks the rows the query shows. */
export function AccountsList() {
  const { status, ticked } = useAppStore((state) => state.accounts);
  const setTicked = useAppStore((state) => state.accountsSetTicked);
  const { flows, track } = useAccountActions();
  const { verbs } = useAccountBulk();
  const view = useAccountView();
  const reason = status === "loading" ? LOADING_REASON : undefined;
  const all = {
    label: "Select all accounts",
    checked: tickState(view.visible.map((row) => String(row.id)), ticked.map(String)),
    onToggle: (on: boolean) => setTicked(on ? view.visible.map((row) => row.id) : []),
    disabled: view.visible.length === 0,
  };
  const strip = (
    <TableStrip
      label="Accounts table"
      noun="accounts"
      query={<ListQueryBar def={LIST_BARS.accounts} query={view.query} handlers={view.handlers} />}
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
