import { List, RefreshCw } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/account-copy";
import { usePlaylistActions } from "@/hooks/usePlaylistActions";
import { useAppStore } from "@/store/app-store";
import { PlaylistRows } from "./PlaylistRows";

/** `Playlists`: the list group with a ghost `Refresh` in the heading, which reads the playlists, the jobs behind
 *  `Sync now` and the audit tail. It is disabled with `Loading.` while a read runs. */
export function PlaylistsList() {
  const loading = useAppStore((state) => state.playlists.status === "loading");
  const { flows, track } = usePlaylistActions();
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
    <ListGroup id="pl-list" icon={List} title="Playlists" action={refresh}>
      <PlaylistRows />
    </ListGroup>
  );
}
