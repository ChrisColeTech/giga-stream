import { List } from "lucide-react";
import { TableStrip } from "@giga/ui/lists/TableStrip";
import type { StripVerb } from "@giga/ui/lists/TableStrip";
import { ListGroup } from "@/components/records/ListGroup";
import { LOADING_REASON } from "@/constants/account-copy";
import { usePlaylistActions } from "@/hooks/usePlaylistActions";
import { usePlaylistView } from "@/hooks/usePlaylistView";
import { LIST_BARS } from "@/constants/list-query-copy";
import { tickState } from "@/lib/list-query";
import { useAppStore } from "@/store/app-store";
import { ListQueryBar } from "@/components/records/ListQueryBar";
import { PlaylistRows } from "./PlaylistRows";

/** `Playlists`: the list group. Its first rows (`01` section 9) are the query row (search, Sort, State and Last run) and
 *  `Refresh` (it reads the playlists, the jobs behind `Sync now` and the audit tail, disabled with `Loading.` while a
 *  read runs), then `Sync now`, `Enable`, `Disable` and the armed `Delete`, always drawn and disabled with their reason
 *  until a row is ticked; the three-state `All` ticks the rows the query shows. `Jobs →` is the page toolbar's. The
 *  heading carries nothing. */
export function PlaylistsList({ verbs }: { readonly verbs: readonly StripVerb[] }) {
  const { status, ticked } = useAppStore((state) => state.playlists);
  const setTicked = useAppStore((state) => state.playlistsSetTicked);
  const { flows, track } = usePlaylistActions();
  const view = usePlaylistView();
  const reason = status === "loading" ? LOADING_REASON : undefined;
  const all = {
    label: "Select all playlists",
    checked: tickState(view.visible.map((row) => String(row.id)), ticked.map(String)),
    onToggle: (on: boolean) => setTicked(on ? view.visible.map((row) => row.id) : []),
    disabled: view.visible.length === 0,
  };
  const strip = (
    <TableStrip
      label="Playlists table"
      noun="playlists"
      query={<ListQueryBar def={LIST_BARS.playlists} query={view.query} handlers={view.handlers} />}
      refresh={{ onPress: () => void track("refresh", flows.refresh), reason }}
      selection={{ verbs }}
    />
  );
  return (
    <ListGroup id="pl-list" icon={List} title="Playlists" strip={strip} all={all} fill>
      <PlaylistRows />
    </ListGroup>
  );
}
