import { List } from "lucide-react";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/account-copy";
import { usePlaylistActions } from "@/hooks/usePlaylistActions";
import { usePlaylistBulk } from "@/hooks/usePlaylistBulk";
import { selectAll } from "@/lib/playlist-rows";
import { useAppStore } from "@/store/app-store";
import { PlaylistRows } from "./PlaylistRows";

/** `Playlists`: the list group. Its first row (`01` section 9) holds `Refresh` (it reads the playlists, the jobs behind
 *  `Sync now` and the audit tail, disabled with `Loading.` while a read runs), then `Sync now`, `Enable`, `Disable` and
 *  the armed `Delete`, always drawn and disabled with their reason until a row is ticked; on the right the three-state
 *  `All`. `Jobs →` is the page toolbar's. The heading carries nothing. */
export function PlaylistsList() {
  const { status, items, ticked } = useAppStore((state) => state.playlists);
  const tickAll = useAppStore((state) => state.playlistsTickAll);
  const { flows, track } = usePlaylistActions();
  const { verbs } = usePlaylistBulk();
  const reason = status === "loading" ? LOADING_REASON : undefined;
  const all = { label: "Select all playlists", checked: selectAll(items, ticked), onToggle: tickAll };
  const strip = (
    <TableStrip
      label="Playlists table"
      noun="playlists"
      refresh={{ onPress: () => void track("refresh", flows.refresh), reason }}
      selection={{ verbs, all: { ...all, disabled: items.length === 0 } }}
    />
  );
  return (
    <ListGroup id="pl-list" icon={List} title="Playlists" strip={strip}>
      <PlaylistRows />
    </ListGroup>
  );
}
