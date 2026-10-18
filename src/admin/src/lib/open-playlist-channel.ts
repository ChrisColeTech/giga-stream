import type { AppState } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";

/** A channel link on the Playlists tab opens that channel on the Channels tab. The row may be on no loaded page of the
 *  Channels list, so the tab is handed the row first (`opened`): without it the workspace finds nothing and closes with
 *  `no longer exists`. */
export function openPlaylistChannel(
  channel: AdminChannel,
  store: Pick<AppState, "channelRemember" | "requestTab">,
): void {
  store.channelRemember(channel);
  store.requestTab("channels", channel.id);
}
