import { Plug } from "lucide-react";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/provider-copy";
import { useProviderActions } from "@/hooks/useProviderActions";
import { useProviderBulk } from "@/hooks/useProviderBulk";
import { providerSelectAll } from "@/lib/provider-rows";
import { useAppStore } from "@/store/app-store";
import { ProviderRows } from "./ProviderRows";

/** `Providers`: the list group. Its first row (`01` section 9) holds `Refresh` (it reads the providers and the audit tail
 *  together, disabled with `Loading.` while a read runs), then `Enable`, `Disable` and the armed `Delete`, always drawn
 *  and disabled with their reason until a row is ticked; on the right the three-state `All`. `Titles →` is the page
 *  toolbar's. The heading carries nothing. */
export function ProvidersList() {
  const { status, items, ticked } = useAppStore((state) => state.providers);
  const tickAll = useAppStore((state) => state.providersTickAll);
  const { flows, track } = useProviderActions();
  const { verbs } = useProviderBulk();
  const reason = status === "loading" ? LOADING_REASON : undefined;
  const all = {
    label: "Select all providers",
    checked: providerSelectAll(items, ticked),
    onToggle: tickAll,
    disabled: items.length === 0,
  };
  const strip = (
    <TableStrip
      label="Providers table"
      noun="providers"
      refresh={{ onPress: () => void track("refresh", flows.refresh), reason }}
      selection={{ verbs }}
    />
  );

  return (
    <ListGroup id="pv-list" icon={Plug} title="Providers" strip={strip} all={all}>
      <ProviderRows />
    </ListGroup>
  );
}
