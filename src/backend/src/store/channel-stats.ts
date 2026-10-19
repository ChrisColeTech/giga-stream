import { z } from "zod";

import type { Database } from "./database.js";

const CountsRow = z.object({
  playlist_id: z.number().int(),
  channels: z.number().int(),
  enabled: z.number().int(),
  online: z.number().int(),
  offline: z.number().int(),
});

/** What a playlist view counts of its channels. */
export interface PlaylistChannelCounts {
  channels: number;
  enabled: number;
  online: number;
  offline: number;
}

const GROUPED_SQL = `
  SELECT playlist_id, COUNT(*) AS channels, COALESCE(SUM(enabled), 0) AS enabled,
    COALESCE(SUM(status = 'online'), 0) AS online, COALESCE(SUM(status = 'offline'), 0) AS offline
  FROM channels WHERE playlist_id IS NOT NULL GROUP BY playlist_id`;

/** Per-playlist counts of channels, read in one grouped query (docs/43 section 3.1: the playlist view). */
export function createChannelStats(db: Database) {
  return {
    async byPlaylist(): Promise<Map<number, PlaylistChannelCounts>> {
      const counts = new Map<number, PlaylistChannelCounts>();
      for (const row of (await db.execute(GROUPED_SQL)).rows) {
        const r = CountsRow.parse(row);
        counts.set(r.playlist_id, { channels: r.channels, enabled: r.enabled, online: r.online, offline: r.offline });
      }
      return counts;
    },
  };
}
