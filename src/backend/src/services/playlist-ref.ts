import type { StoredPlaylist } from "../store/sync-settings-repository.js";
import type { PlaylistRef } from "../types/playlist-sync.js";

/**
 * A playlist as any read may show it (docs/26 section 3.11): its id, its host and a masked address. The full
 * address can carry credentials in its query, so it never leaves the store except into the sync's own fetch.
 */
export function playlistRefOf(playlist: StoredPlaylist): PlaylistRef {
  const host = new URL(playlist.url).host;
  return { id: playlist.id, host, masked: `https://${host}/…` };
}
