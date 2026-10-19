import { z } from "zod";

import type { Database } from "./database.js";

const Row = z.object({
  id: z.number().int(),
  name: z.string(),
  kind: z.enum(["file", "url"]),
  url: z.string().nullable(),
  file_name: z.string().nullable(),
  host: z.string().nullable(),
  enabled: z.number().int(),
  created_at: z.number().int(),
});
const IdRow = z.object({ id: z.number().int() });

/**
 * A playlist record (docs/43 section 3.1). `url` can carry credentials in its query: the admin's view shows it in
 * full, but audit entries, errors and logs carry `host` alone. A `file` playlist has a `fileName` (the upload is not kept).
 */
export interface PlaylistRecord {
  id: number;
  name: string;
  kind: "file" | "url";
  url?: string;
  fileName?: string;
  host?: string;
  enabled: boolean;
  createdAt: number;
}

/** What a new playlist is made of: exactly the columns its kind needs. */
export type NewPlaylist =
  | { kind: "file"; name: string; fileName: string; enabled: boolean }
  | { kind: "url"; name: string; url: string; host: string; enabled: boolean };

function toPlaylist(row: unknown): PlaylistRecord {
  const r = Row.parse(row);
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    ...(r.url !== null && { url: r.url }),
    ...(r.file_name !== null && { fileName: r.file_name }),
    ...(r.host !== null && { host: r.host }),
    enabled: r.enabled === 1,
    createdAt: r.created_at,
  };
}

const COLUMNS = "id, name, kind, url, file_name, host, enabled, created_at";

const SQL = {
  all: `SELECT ${COLUMNS} FROM playlists ORDER BY id`,
  one: `SELECT ${COLUMNS} FROM playlists WHERE id = ?`,
  insert: "INSERT INTO playlists (name, kind, url, file_name, host, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  update: "UPDATE playlists SET name = ?, url = ?, host = ?, enabled = ? WHERE id = ?",
  remove: "DELETE FROM playlists WHERE id = ?",
  byUrl: "SELECT id FROM playlists WHERE url = ?",
  byFileName: "SELECT id FROM playlists WHERE file_name = ?",
  byName: "SELECT id FROM playlists WHERE name = ? COLLATE NOCASE",
};

/** The playlists (docs/43 section 3.1), in the order they were added. */
export function createPlaylistRepository(db: Database) {
  const idOf = async (sql: string, arg: string): Promise<number | undefined> => {
    const row = (await db.execute({ sql, args: [arg] })).rows[0];
    return row === undefined ? undefined : IdRow.parse(row).id;
  };

  return {
    list: async (): Promise<PlaylistRecord[]> => (await db.execute(SQL.all)).rows.map(toPlaylist),
    find: async (id: number): Promise<PlaylistRecord | undefined> => {
      const row = (await db.execute({ sql: SQL.one, args: [id] })).rows[0];
      return row === undefined ? undefined : toPlaylist(row);
    },
    /** The id of the playlist with exactly this web address, if any. */
    idOfUrl: (url: string): Promise<number | undefined> => idOf(SQL.byUrl, url),
    /** The id of the playlist made from a file of this (sanitised) name, if any. */
    idOfFileName: (fileName: string): Promise<number | undefined> => idOf(SQL.byFileName, fileName),
    /** The id of the playlist with this name, ignoring case, if any. */
    idOfName: (name: string): Promise<number | undefined> => idOf(SQL.byName, name),
    /** The `UNIQUE` columns decide a duplicate: a clash raises, and the service maps it to `409 playlist.taken`. */
    insert: async (p: NewPlaylist, at: number): Promise<number> => {
      const [url, fileName, host] = p.kind === "url" ? [p.url, null, p.host] : [null, p.fileName, null];
      const result = await db.execute({
        sql: SQL.insert,
        args: [p.name, p.kind, url, fileName, host, p.enabled ? 1 : 0, at],
      });
      return Number(result.lastInsertRowid);
    },
    update: async (p: { id: number; name: string; url?: string; host?: string; enabled: boolean }): Promise<void> => {
      await db.execute({ sql: SQL.update, args: [p.name, p.url ?? null, p.host ?? null, p.enabled ? 1 : 0, p.id] });
    },
    remove: async (id: number): Promise<boolean> =>
      (await db.execute({ sql: SQL.remove, args: [id] })).rowsAffected > 0,
  };
}

export type PlaylistRepository = ReturnType<typeof createPlaylistRepository>;
