import type { PlaylistRecord } from "../store/playlist-repository.js";
import type { Store } from "../store/store.js";
import type { PlaylistView } from "../types/playlist.js";

const NO_CHANNELS = { channels: 0, enabled: 0, online: 0, offline: 0 };

/**
 * The playlist as a signed-in admin reads it: its columns (the web address in full, docs/03 section 7.2c), the counts of its channels, and the last
 * run joined in from its one sync job (docs/43 section 3.1).
 */
export async function playlistView(
  store: Store,
  playlist: PlaylistRecord,
  counts?: Awaited<ReturnType<Store["channels"]["countsByPlaylist"]>>,
): Promise<PlaylistView> {
  const stats = (counts ?? (await store.channels.countsByPlaylist())).get(playlist.id) ?? NO_CHANNELS;
  const job = await store.jobs.findOfPlaylist(playlist.id);
  return {
    id: playlist.id,
    name: playlist.name,
    kind: playlist.kind,
    ...(playlist.url !== undefined && { url: playlist.url }),
    ...(playlist.host !== undefined && { host: playlist.host }),
    ...(playlist.fileName !== undefined && { fileName: playlist.fileName }),
    enabled: playlist.enabled,
    channels: stats.channels,
    enabledChannels: stats.enabled,
    online: stats.online,
    offline: stats.offline,
    ...(job?.lastRunAt !== undefined && { lastRunAt: job.lastRunAt }),
    ...(job?.lastResult !== undefined && { lastResult: job.lastResult }),
    ...(job?.lastCounts !== undefined && { lastCounts: job.lastCounts }),
  };
}
