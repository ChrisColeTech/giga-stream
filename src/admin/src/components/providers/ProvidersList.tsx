import { Plug } from "lucide-react";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/provider-copy";
import { useProviderActions } from "@/hooks/useProviderActions";
import { useProviderBulk } from "@/hooks/useProviderBulk";
import { useAppStore } from "@/store/app-store";
import { ProviderRows } from "./ProviderRows";

/** `Providers`: the list group. Its table strip holds `Refresh` (it reads the providers and the audit tail together,
 *  disabled with `Loading.` while a read runs) and, once rows are ticked, the count, `Enable`, `Disable`, the armed
 *  `Delete` and `Clear selection`. The heading carries nothing. */
export function ProvidersList() {
  const loading = useAppStore((state) => state.providers.status === "loading");
  const ticked = useAppStore((state) => state.providers.ticked);
  const setTicked = useAppStore((state) => state.providersSetTicked);
  const { flows, track } = useProviderActions();
  const { verbs } = useProviderBulk();
  const strip = (
    <TableStrip
      label="Providers table"
      noun="providers"
      refresh={{ onPress: () => void track("refresh", flows.refresh), reason: loading ? LOADING_REASON : undefined }}
      selection={{ count: ticked.length, verbs, onClear: () => setTicked([]) }}
    />
  );

  return (
    <ListGroup id="pv-list" icon={Plug} title="Providers" strip={strip}>
      <ProviderRows />
    </ListGroup>
  );
}
