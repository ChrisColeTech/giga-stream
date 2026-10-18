import { TabPage, type PageProps } from "@/components/chrome/TabPage";
import { PlaylistWorkspace } from "@/components/playlists/PlaylistWorkspace";
import { PlaylistsIndex } from "@/components/playlists/PlaylistsIndex";
import { usePlaylistsLoad } from "@/hooks/usePlaylistsLoad";
import { useAppStore } from "@/store/app-store";

/** Playlists: the index (bulk toolbar, `New playlist`, the list) or, when a row is open, that playlist's workspace. The
 *  page is the only reader of `workspaces.playlists`. It loads the playlists when first shown in a session and when
 *  another tab's write marked them stale. */
export function PlaylistsPage({ active }: PageProps) {
  const openId = useAppStore((state) => state.workspaces.playlists);
  usePlaylistsLoad(active);
  return (
    <TabPage active={active} label="Playlists">
      {openId === null ? <PlaylistsIndex /> : <PlaylistWorkspace id={openId} active={active} />}
    </TabPage>
  );
}
