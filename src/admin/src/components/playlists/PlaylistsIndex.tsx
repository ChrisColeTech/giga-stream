import { Workspace } from "@giga/ui/form/Workspace";
import { NEW_PLAYLIST_LABELS } from "@/constants/playlist-copy";
import { NewPlaylistForm } from "./NewPlaylistForm";
import { PlaylistsList } from "./PlaylistsList";

/** The Playlists index: `New playlist` and the list, whose table strip holds the bulk verbs and the `Go to Jobs`
 *  icon. No page toolbar sits above them. */
export function PlaylistsIndex() {
  return (
    <Workspace labels={NEW_PLAYLIST_LABELS}>
      <NewPlaylistForm />
      <PlaylistsList />
    </Workspace>
  );
}
