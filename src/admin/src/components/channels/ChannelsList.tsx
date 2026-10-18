import { Radio, RefreshCw } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/channel-copy";
import { useChannelActions } from "@/hooks/useChannelActions";
import { useAppStore } from "@/store/app-store";
import { ChannelRows } from "./ChannelRows";

/** `Channels`: the list group with a ghost `Refresh` in the heading, which reads `GET /api/admin-channels` again and
 *  replaces the list (the only way a `preparing` row is seen `live`: nothing polls). Disabled with `Loading.` while a read
 *  runs. */
export function ChannelsList() {
  const loading = useAppStore((state) => state.channels.status === "loading");
  const { flows, track } = useChannelActions();
  const refresh = (
    <Button variant="ghost" size="sm" reason={loading ? LOADING_REASON : undefined} onClick={() => void track("refresh", flows.refresh)}>
      <RefreshCw aria-hidden /> Refresh
    </Button>
  );

  return (
    <ListGroup id="ch-list" icon={Radio} title="Channels" action={refresh}>
      <ChannelRows />
    </ListGroup>
  );
}
