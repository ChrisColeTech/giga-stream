import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const Row = z.object({
  id: z.number().int(),
  kind: z.enum(["channel", "movie", "tv"]),
  host: z.string().nullable(),
  tvg_id: z.string().nullable(),
  sync_name: z.string().nullable(),
  tmdb_id: z.number().int().nullable(),
  label: z.string(),
  created_at: z.number().int(),
});

/** What an admin deleted from a sync, shown so it can be restored (docs/26 section 3.10, rule 4). */
export interface Tombstone {
  id: number;
  kind: "channel" | "movie" | "tv";
  /** A channel's playlist host, and its tvg-id and/or sync name (at least one). */
  host?: string;
  tvgId?: string;
  syncName?: string;
  /** A title's TMDB id. */
  tmdbId?: number;
  /** The name it had, for the list. */
  label: string;
  createdAt: number;
}

function toTombstone(row: unknown): Tombstone {
  const r = Row.parse(row);
  return {
    id: r.id,
    kind: r.kind,
    ...(r.host !== null && { host: r.host }),
    ...(r.tvg_id !== null && { tvgId: r.tvg_id }),
    ...(r.sync_name !== null && { syncName: r.sync_name }),
    ...(r.tmdb_id !== null && { tmdbId: r.tmdb_id }),
    label: r.label,
    createdAt: r.created_at,
  };
}

const COLUMNS = "id, kind, host, tvg_id, sync_name, tmdb_id, label, created_at";

/** The tombstones of the playlist sync (channels) and the catalog sync (titles). */
export function createTombstoneRepository(db: DatabaseSync) {
  const channels = db.prepare(`SELECT ${COLUMNS} FROM sync_tombstones WHERE kind = 'channel' ORDER BY id DESC`);
  const titles = db.prepare(`SELECT ${COLUMNS} FROM sync_tombstones WHERE kind IN ('movie', 'tv') ORDER BY id DESC`);
  const one = db.prepare(`SELECT ${COLUMNS} FROM sync_tombstones WHERE id = ?`);
  const hitChannel = db.prepare(`
    SELECT id FROM sync_tombstones
    WHERE kind = 'channel' AND host = ? AND ((? IS NOT NULL AND tvg_id = ?) OR (? IS NOT NULL AND sync_name = ?))`);
  const hitTitle = db.prepare("SELECT id FROM sync_tombstones WHERE kind = ? AND tmdb_id = ?");
  const oneTitle = db.prepare(`SELECT ${COLUMNS} FROM sync_tombstones WHERE kind = ? AND tmdb_id = ?`);
  const insert = db.prepare(
    "INSERT INTO sync_tombstones (kind, host, tvg_id, sync_name, tmdb_id, label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const remove = db.prepare("DELETE FROM sync_tombstones WHERE id = ?");

  return {
    listChannels: (): Tombstone[] => channels.all().map(toTombstone),
    listTitles: (): Tombstone[] => titles.all().map(toTombstone),
    find(id: number): Tombstone | undefined {
      const row = one.get(id);
      return row === undefined ? undefined : toTombstone(row);
    },
    findTitle(kind: "movie" | "tv", tmdbId: number): Tombstone | undefined {
      const row = oneTitle.get(kind, tmdbId);
      return row === undefined ? undefined : toTombstone(row);
    },
    /** Whether a playlist entry (host, tvg-id, name) was deleted by an admin. */
    hasChannel(host: string, tvgId: string | undefined, syncName: string): boolean {
      const tvg = tvgId ?? null;
      return hitChannel.get(host, tvg, tvg, syncName, syncName) !== undefined;
    },
    hasTitle: (kind: "movie" | "tv", tmdbId: number): boolean => hitTitle.get(kind, tmdbId) !== undefined,
    addChannel(entry: { host: string; tvgId: string | null; syncName: string | null; label: string }, at: number): void {
      insert.run("channel", entry.host, entry.tvgId, entry.syncName, null, entry.label, at);
    },
    addTitle(kind: "movie" | "tv", tmdbId: number, label: string, at: number): void {
      if (hitTitle.get(kind, tmdbId) === undefined) insert.run(kind, null, null, null, tmdbId, label, at);
    },
    remove(id: number): boolean {
      return Number(remove.run(id).changes) > 0;
    },
  };
}

export type TombstoneRepository = ReturnType<typeof createTombstoneRepository>;
