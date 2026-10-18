import type { PlaylistRecord } from "../store/playlist-repository.js";
import type { Store } from "../store/store.js";
import type { PlaylistView } from "../types/playlist.js";

/** The masked form of a web playlist's host: all a read ever shows of the address (docs/26 section 3.11). */
export const maskedHost = (host: string): string => `https://${host}/…`;

const NO_CHANNELS = { channels: 0, enabled: 0, live: 0, dead: 0 };

/**
 * The playlist as any read may show it: its columns (never the address), the counts of its channels, and the last
 * run joined in from its one sync job (docs/43 section 3.1).
 */
export function playlistView(store: Store, playlist: PlaylistRecord, counts = store.channels.countsByPlaylist()): PlaylistView {
  const stats = counts.get(playlist.id) ?? NO_CHANNELS;
  const job = store.jobs.findOfPlaylist(playlist.id);
  return {
    id: playlist.id,
    name: playlist.name,
    kind: playlist.kind,
    ...(playlist.host !== undefined && { host: playlist.host, masked: maskedHost(playlist.host) }),
    ...(playlist.fileName !== undefined && { fileName: playlist.fileName }),
    enabled: playlist.enabled,
    channels: stats.channels,
    enabledChannels: stats.enabled,
    live: stats.live,
    dead: stats.dead,
    ...(job?.lastRunAt !== undefined && { lastRunAt: job.lastRunAt }),
    ...(job?.lastResult !== undefined && { lastResult: job.lastResult }),
    ...(job?.lastCounts !== undefined && { lastCounts: job.lastCounts }),
  };
}
