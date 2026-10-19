import { Workspace } from "@giga/ui/form/Workspace";
import { IndexToolbar } from "@/components/records/IndexToolbar";
import { NEW_PLAYLIST_LABELS } from "@/constants/playlist-copy";
import { usePlaylistBulk } from "@/hooks/usePlaylistBulk";
import { NewPlaylistForm } from "./NewPlaylistForm";
import { PlaylistsList } from "./PlaylistsList";

/** The Playlists index: Sync now promotes the ticked set; the strip keeps Enable, Disable and Delete. */
export function PlaylistsIndex() {
  const bulk = usePlaylistBulk();
  return (
    <>
      <IndexToolbar promote={bulk.promote} />
      <Workspace labels={NEW_PLAYLIST_LABELS} fill>
        <NewPlaylistForm />
        <PlaylistsList verbs={bulk.verbs} />
      </Workspace>
    </>
  );
}
