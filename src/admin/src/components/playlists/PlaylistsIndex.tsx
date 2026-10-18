import { Workspace } from "@giga/ui/form/Workspace";
import { IndexToolbar } from "@/components/records/IndexToolbar";
import { NEW_PLAYLIST_LABELS } from "@/constants/playlist-copy";
import { NewPlaylistForm } from "./NewPlaylistForm";
import { PlaylistsList } from "./PlaylistsList";

/** The Playlists index: the page toolbar with `Jobs →` on the right, over `New playlist` and the list, whose first row
 *  holds the bulk verbs. */
export function PlaylistsIndex() {
  return (
    <>
      <IndexToolbar tab="playlists" />
      <Workspace labels={NEW_PLAYLIST_LABELS} fill>
        <NewPlaylistForm />
        <PlaylistsList />
      </Workspace>
    </>
  );
}
