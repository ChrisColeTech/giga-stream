import { useEffect, useState } from "react";
import { sentenceOf } from "@/lib/playlist-flow-result";
import { playlists } from "@/services/playlists";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { useAppStore } from "@/store/app-store";

/** The playlists behind the Channels list's Playlist select (`43` section 4.1), read through the playlists SERVICE (never
 *  the Playlists slice): once when the list opens, and again whenever the list is read at another revision, since an
 *  import, a rename or a delete moves it. A refusal is said once on the notice line and leaves the select at `All
 *  playlists`. */
export function useQueryPlaylists(): readonly AdminPlaylist[] {
  const [items, setItems] = useState<readonly AdminPlaylist[]>([]);
  const serial = useAppStore((state) => state.serial);
  const revision = useAppStore((state) => state.channels.revision);
  const say = useAppStore((state) => state.say);

  useEffect(() => {
    let current = true;
    playlists.list().then(
      (list) => {
        if (current) setItems(list.items);
      },
      (error: unknown) => {
        if (current) say(sentenceOf(error), "warn", "Playlist");
      },
    );
    return () => {
      current = false;
    };
  }, [serial, revision, say]);

  return items;
}
