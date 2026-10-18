import { Plug, RefreshCw } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/provider-copy";
import { useProviderActions } from "@/hooks/useProviderActions";
import { useAppStore } from "@/store/app-store";
import { ProviderRows } from "./ProviderRows";

/** `Providers`: the list group with a ghost `Refresh` in the heading, which reads the providers and the audit tail
 *  together. It is disabled with `Loading.` while a read runs. */
export function ProvidersList() {
  const loading = useAppStore((state) => state.providers.status === "loading");
  const { flows, track } = useProviderActions();
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
    <ListGroup id="pv-list" icon={Plug} title="Providers" action={refresh}>
      <ProviderRows />
    </ListGroup>
  );
}
