import { ToolbarStrip } from "@giga/ui/shell/ToolbarStrip";
import { BulkNotes } from "@/components/records/BulkNotes";
import { INDEX_FRAMES } from "@/constants/index-frames";
import { usePlaylistBulk } from "@/hooks/usePlaylistBulk";
import { indexVerbs } from "@/lib/index-verbs";
import { useAppStore } from "@/store/app-store";

/** The Playlists toolbar (`38` section 3.2): the ghost bulk verbs `Sync now`, `Enable`, `Disable` and the armed
 *  `Delete N playlists?`, each disabled with its reason until a row is ticked, then the filled forward verb `Jobs →`.
 *  What a run could not do is listed under the strip. */
export function PlaylistsToolbar() {
  const { verbs, notes, dismiss } = usePlaylistBulk();
  const requestTab = useAppStore((state) => state.requestTab);
  const forward = indexVerbs(INDEX_FRAMES.playlists.forward, (tab) => requestTab(tab));
  return (
    <>
      <ToolbarStrip label="Playlists toolbar" verbs={[...verbs, ...forward]} />
      <BulkNotes notes={notes} onDismiss={dismiss} />
    </>
  );
}
