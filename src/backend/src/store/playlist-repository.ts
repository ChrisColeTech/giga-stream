import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const Row = z.object({
  id: z.number().int(),
  name: z.string(),
  address: z.string(),
  host: z.string(),
  enabled: z.number().int(),
  last_synced_at: z.number().int().nullable(),
  last_outcome: z.string().nullable(),
  created_at: z.number().int(),
});

/** A playlist record. `address` is a secret: only the playlist sync's own fetch reads it. */
export interface PlaylistRecord {
  id: number;
  name: string;
  address: string;
  host: string;
  enabled: boolean;
  lastSyncedAt?: number;
  lastOutcome?: string;
  createdAt: number;
}

function toPlaylist(row: unknown): PlaylistRecord {
  const r = Row.parse(row);
  return {
    id: r.id,
    name: r.name,
    address: r.address,
    host: r.host,
    enabled: r.enabled === 1,
    ...(r.last_synced_at !== null && { lastSyncedAt: r.last_synced_at }),
    ...(r.last_outcome !== null && { lastOutcome: r.last_outcome }),
    createdAt: r.created_at,
  };
}

const COLUMNS = "id, name, address, host, enabled, last_synced_at, last_outcome, created_at";

/** The playlists (docs/26 section 3.11), in the order they were added. */
export function createPlaylistRepository(db: DatabaseSync) {
  const all = db.prepare(`SELECT ${COLUMNS} FROM playlists ORDER BY id`);
  const one = db.prepare(`SELECT ${COLUMNS} FROM playlists WHERE id = ?`);
  const insert = db.prepare("INSERT INTO playlists (name, address, host, enabled, created_at) VALUES (?, ?, ?, ?, ?)");
  const update = db.prepare("UPDATE playlists SET name = ?, address = ?, host = ?, enabled = ? WHERE id = ?");
  const record = db.prepare("UPDATE playlists SET last_synced_at = ?, last_outcome = ? WHERE id = ?");
  const remove = db.prepare("DELETE FROM playlists WHERE id = ?");
  const byAddress = db.prepare("SELECT id FROM playlists WHERE address = ?");

  return {
    list: (): PlaylistRecord[] => all.all().map(toPlaylist),
    find(id: number): PlaylistRecord | undefined {
      const row = one.get(id);
      return row === undefined ? undefined : toPlaylist(row);
    },
    /** The id of the playlist with exactly this address, if any. */
    idOfAddress(address: string): number | undefined {
      const row = byAddress.get(address);
      return row === undefined ? undefined : z.object({ id: z.number() }).parse(row).id;
    },
    insert(p: { name: string; address: string; host: string; enabled: boolean }, at: number): number {
      return Number(insert.run(p.name, p.address, p.host, p.enabled ? 1 : 0, at).lastInsertRowid);
    },
    update(p: { id: number; name: string; address: string; host: string; enabled: boolean }): void {
      update.run(p.name, p.address, p.host, p.enabled ? 1 : 0, p.id);
    },
    recordSync(id: number, at: number, outcome: string): void {
      record.run(at, outcome, id);
    },
    remove(id: number): boolean {
      return Number(remove.run(id).changes) > 0;
    },
  };
}

export type PlaylistRepository = ReturnType<typeof createPlaylistRepository>;
