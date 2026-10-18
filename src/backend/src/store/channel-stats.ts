import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const CountsRow = z.object({
  playlist_id: z.number().int(),
  channels: z.number().int(),
  enabled: z.number().int(),
  live: z.number().int(),
  dead: z.number().int(),
});

/** What a playlist view counts of its channels. */
export interface PlaylistChannelCounts {
  channels: number;
  enabled: number;
  live: number;
  dead: number;
}

/** Per-playlist counts of channels, read in one grouped query (docs/43 section 3.1: the playlist view). */
export function createChannelStats(db: DatabaseSync) {
  const grouped = db.prepare(`
    SELECT playlist_id, COUNT(*) AS channels, COALESCE(SUM(enabled), 0) AS enabled,
      COALESCE(SUM(status = 'live'), 0) AS live, COALESCE(SUM(status = 'dead'), 0) AS dead
    FROM channels WHERE playlist_id IS NOT NULL GROUP BY playlist_id`);
  return {
    byPlaylist(): Map<number, PlaylistChannelCounts> {
      const counts = new Map<number, PlaylistChannelCounts>();
      for (const row of grouped.all()) {
        const r = CountsRow.parse(row);
        counts.set(r.playlist_id, { channels: r.channels, enabled: r.enabled, live: r.live, dead: r.dead });
      }
      return counts;
    },
  };
}
