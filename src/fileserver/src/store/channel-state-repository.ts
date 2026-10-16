import { z } from "zod";

import type { Database } from "./database.js";

export interface ChannelStateRepository {
  /** The last selected channel id as stored; it may name a channel that no longer exists. */
  readLastChannelId(): string | undefined;
  writeLastChannelId(channelId: string | null): void;
}

export function createChannelStateRepository(db: Database): ChannelStateRepository {
  const select = db.prepare("SELECT last_channel_id FROM channel_state WHERE id = 1");
  const upsert = db.prepare(
    `INSERT INTO channel_state (id, last_channel_id) VALUES (1, ?)
     ON CONFLICT (id) DO UPDATE SET last_channel_id = excluded.last_channel_id`,
  );

  return {
    readLastChannelId() {
      const row = z.object({ last_channel_id: z.string().nullable() }).safeParse(select.get());
      return row.success && row.data.last_channel_id !== null ? row.data.last_channel_id : undefined;
    },

    writeLastChannelId(channelId) {
      upsert.run(channelId);
    },
  };
}
