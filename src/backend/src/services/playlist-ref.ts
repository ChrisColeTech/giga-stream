import type { PlaylistRecord } from "../store/playlist-repository.js";
import type { PlaylistRef } from "../types/playlist-sync.js";

/** The masked form of a playlist's host: all a read ever shows of the address (docs/26 section 3.11). */
export const maskedHost = (host: string): string => `https://${host}/…`;

/**
 * A playlist as any read may show it: its id, name, host and a masked address. The full address can carry
 * credentials in its query, so it never leaves the store except into the sync's own fetch.
 */
export const playlistRefOf = (playlist: PlaylistRecord): PlaylistRef => ({
  id: playlist.id,
  name: playlist.name,
  host: playlist.host,
  masked: maskedHost(playlist.host),
});
