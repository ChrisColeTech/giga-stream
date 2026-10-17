import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const ValueRow = z.object({ value: z.string() });
const Playlists = z.array(z.object({ id: z.number().int(), url: z.string() }));

export type SyncSettingKey = "title_schedule" | "playlist_schedule" | "playlist_urls" | "playlist_next_id";

/** A playlist address as stored: with its full URL, which only the playlist sync reads. */
export interface StoredPlaylist {
  id: number;
  url: string;
}

/** The sync settings (docs/26 section 3.11): schedules and playlist addresses, one row per key. */
export function createSyncSettingsRepository(db: DatabaseSync) {
  const one = db.prepare("SELECT value FROM sync_settings WHERE key = ?");
  const put = db.prepare(`
    INSERT INTO sync_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`);

  const get = (key: SyncSettingKey): string | undefined => {
    const row = one.get(key);
    return row === undefined ? undefined : ValueRow.parse(row).value;
  };

  return {
    get,
    has: (key: SyncSettingKey): boolean => get(key) !== undefined,
    set(key: SyncSettingKey, value: string, at: number): void {
      put.run(key, value, at);
    },
    /** The stored playlists, in the order they were added. */
    playlists(): StoredPlaylist[] {
      const json = get("playlist_urls");
      return json === undefined ? [] : Playlists.parse(JSON.parse(json));
    },
    setPlaylists(list: StoredPlaylist[], at: number): void {
      put.run("playlist_urls", JSON.stringify(list), at);
    },
  };
}

export type SyncSettingsRepository = ReturnType<typeof createSyncSettingsRepository>;
