import { Workspace } from "@giga/ui/form/Workspace";
import { NEW_PLAYLIST_LABELS } from "@/constants/playlist-copy";
import { NewPlaylistForm } from "./NewPlaylistForm";
import { PlaylistsList } from "./PlaylistsList";
import { IndexToolbar } from "@/components/records/IndexToolbar";
import { INDEX_FRAMES } from "@/constants/index-frames";

/** The Playlists index: the toolbar (the `Jobs` arrow) over `New playlist` and the list, whose table strip holds the
 *  bulk verbs. */
export function PlaylistsIndex() {
  return (
    <>
      <IndexToolbar frame={INDEX_FRAMES.playlists} />
      <Workspace labels={NEW_PLAYLIST_LABELS}>
        <NewPlaylistForm />
        <PlaylistsList />
      </Workspace>
    </>
  );
}
