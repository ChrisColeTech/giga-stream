import { NO_CHANNELS_REASON } from "@/constants/playlist-copy";
import { queryOfPlaylist } from "@/lib/channel-query";
import type { ToolbarAction } from "@/lib/workspace-verbs";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { useAppStore } from "@/store/app-store";
import { useChannelFlows } from "./useChannelFlows";

/** A playlist workspace's forward verb, `Channels →` (`43` section 4.1): it sets the Channels list's Playlist filter to
 *  this playlist (every other filter back to its default, so nothing hides its channels) and goes to that tab. The query
 *  is set first so a Channels tab that has not loaded yet reads the filtered list, never the whole one. Disabled with
 *  `This playlist has no channels.` while it has none. */
export function usePlaylistChannelsVerb(playlist: AdminPlaylist): ToolbarAction {
  const flows = useChannelFlows();
  const requestTab = useAppStore((state) => state.requestTab);
  return {
    label: "Channels",
    ...(playlist.channels === 0 && { reason: NO_CHANNELS_REASON }),
    onPress: () => {
      void flows.setQuery(queryOfPlaylist(playlist.id));
      requestTab("channels");
    },
  };
}
