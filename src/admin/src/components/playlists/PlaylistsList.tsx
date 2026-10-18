import { List } from "lucide-react";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/account-copy";
import { useForwardVerbs } from "@/hooks/useForwardVerbs";
import { usePlaylistActions } from "@/hooks/usePlaylistActions";
import { usePlaylistBulk } from "@/hooks/usePlaylistBulk";
import { useAppStore } from "@/store/app-store";
import { PlaylistRows } from "./PlaylistRows";

/** `Playlists`: the list group. Its table strip holds `Refresh` (it reads the playlists, the jobs behind `Sync now` and
 *  the audit tail, disabled with `Loading.` while a read runs) and, once rows are ticked, the count, `Sync now`, `Enable`,
 *  `Disable`, the armed `Delete` and `Clear selection`. The heading carries nothing. */
export function PlaylistsList() {
  const loading = useAppStore((state) => state.playlists.status === "loading");
  const ticked = useAppStore((state) => state.playlists.ticked);
  const setTicked = useAppStore((state) => state.playlistsSetTicked);
  const { flows, track } = usePlaylistActions();
  const { verbs } = usePlaylistBulk();
  const forward = useForwardVerbs("playlists");
  const strip = (
    <TableStrip
      label="Playlists table"
      noun="playlists"
      forward={forward}
      refresh={{ onPress: () => void track("refresh", flows.refresh), reason: loading ? LOADING_REASON : undefined }}
      selection={{ count: ticked.length, verbs, onClear: () => setTicked([]) }}
    />
  );
  return (
    <ListGroup id="pl-list" icon={List} title="Playlists" strip={strip}>
      <PlaylistRows />
    </ListGroup>
  );
}
