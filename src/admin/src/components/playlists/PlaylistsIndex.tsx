import { Workspace } from "@giga/ui/form/Workspace";
import { NEW_PLAYLIST_LABELS } from "@/constants/playlist-copy";
import { NewPlaylistForm } from "./NewPlaylistForm";
import { PlaylistsList } from "./PlaylistsList";
import { PlaylistsToolbar } from "./PlaylistsToolbar";

/** The Playlists index: the toolbar (bulk verbs and `Jobs →`) over `New playlist` and the list. */
export function PlaylistsIndex() {
  return (
    <>
      <PlaylistsToolbar />
      <Workspace labels={NEW_PLAYLIST_LABELS}>
        <NewPlaylistForm />
        <PlaylistsList />
      </Workspace>
    </>
  );
}
