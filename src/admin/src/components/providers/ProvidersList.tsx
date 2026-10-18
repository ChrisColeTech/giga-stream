import { Plug } from "lucide-react";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/provider-copy";
import { useProviderActions } from "@/hooks/useProviderActions";
import { useProviderBulk } from "@/hooks/useProviderBulk";
import { useProviderView } from "@/hooks/useProviderView";
import { LIST_BARS } from "@/constants/list-query-copy";
import { tickState } from "@/lib/list-query";
import { useAppStore } from "@/store/app-store";
import { ListQueryBar } from "@/components/records/ListQueryBar";
import { ProviderRows } from "./ProviderRows";

/** `Providers`: the list group. Its first rows (`01` section 9) are the query row (search, Sort, State and Family) and
 *  `Refresh` (it reads the providers and the audit tail together, disabled with `Loading.` while a read runs), then
 *  `Enable`, `Disable` and the armed `Delete`, always drawn and disabled with their reason until a row is ticked; the
 *  three-state `All` ticks the rows the query shows. `Titles →` is the page toolbar's. The heading carries nothing. */
export function ProvidersList() {
  const { status, ticked } = useAppStore((state) => state.providers);
  const setTicked = useAppStore((state) => state.providersSetTicked);
  const { flows, track } = useProviderActions();
  const { verbs } = useProviderBulk();
  const view = useProviderView();
  const reason = status === "loading" ? LOADING_REASON : undefined;
  const all = {
    label: "Select all providers",
    checked: tickState(view.visible.map((row) => String(row.id)), ticked.map(String)),
    onToggle: (on: boolean) => setTicked(on ? view.visible.map((row) => row.id) : []),
    disabled: view.visible.length === 0,
  };
  const strip = (
    <TableStrip
      label="Providers table"
      noun="providers"
      query={<ListQueryBar def={LIST_BARS.providers} query={view.query} handlers={view.handlers} />}
      refresh={{ onPress: () => void track("refresh", flows.refresh), reason }}
      selection={{ verbs }}
    />
  );

  return (
    <ListGroup id="pv-list" icon={Plug} title="Providers" strip={strip} all={all} fill>
      <ProviderRows />
    </ListGroup>
  );
}
