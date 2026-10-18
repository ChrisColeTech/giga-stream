import { useEffect, useState } from "react";
import { channels } from "@/services/channels";
import { sentenceOf } from "@/lib/playlist-flow-result";
import { useAppStore } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";

/** What the Status group knows of a playlist's channels: still reading, read, or refused (the shimmer stays). The rows
 *  are whole, so opening one can hand the Channels tab the row (it may be on no loaded page). */
export type PlaylistChannels =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly items: readonly AdminChannel[] }
  | { readonly status: "refused" };

/** The one cross-tab read of the Playlists tab (`38` section 3.4): the admin channels whose `source` is this playlist's
 *  host, through the channels SERVICE (never the Channels slice or its components), read when the workspace opens on a
 *  playlist. A refusal (until the Channels wave wires the service: not connected) is said once on the notice line and
 *  leaves the group's shimmer lines in place: a visible refusal, never an invented list. */
export function usePlaylistChannels(host: string): PlaylistChannels {
  const [view, setView] = useState<PlaylistChannels>({ status: "loading" });
  const say = useAppStore((state) => state.say);
  const serial = useAppStore((state) => state.serial);

  useEffect(() => {
    let current = true;
    setView({ status: "loading" });
    channels.list().then(
      (list) => {
        if (!current) return;
        setView({ status: "ready", items: list.items.filter((channel) => channel.source === host) });
      },
      (error: unknown) => {
        if (!current) return;
        setView({ status: "refused" });
        say(sentenceOf(error), "warn", "Playlist");
      },
    );
    return () => {
      current = false;
    };
  }, [host, serial, say]);

  return view;
}
