import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { usePlaylistActions } from "./usePlaylistActions";

/** Loads the playlists (and the jobs list, for `Sync now`'s reasons) when the tab is first shown in a session and again
 *  when another tab's write marked them stale; never otherwise, and never on a timer. A new session first resets the
 *  slice, so nothing of the last account is shown. A failed read leaves the status `failed`: the list's Refresh is the
 *  way back. */
export function usePlaylistsLoad(active: boolean): void {
  const { flows } = usePlaylistActions();
  const serial = useAppStore((state) => state.serial);
  const held = useAppStore((state) => state.playlists.session);
  const status = useAppStore((state) => state.playlists.status);
  const stale = useAppStore((state) => state.stale.playlists);
  const reset = useAppStore((state) => state.playlistsReset);
  const clearStale = useAppStore((state) => state.clearStale);

  useEffect(() => {
    if (held !== serial) reset(serial);
  }, [held, serial, reset]);

  useEffect(() => {
    if (!active || held !== serial || (status !== "idle" && !stale)) return;
    clearStale("playlists");
    void flows.load();
  }, [active, held, serial, status, stale, flows, clearStale]);
}
