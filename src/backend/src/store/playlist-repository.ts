import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

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
 * A playlist record (docs/43 section 3.1). `url` is a secret - it can carry credentials in its query - and is read
 * only by the fetch; every view shows `host` alone. A `file` playlist has a `fileName` (the upload is not kept).
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

/** The playlists (docs/43 section 3.1), in the order they were added. */
export function createPlaylistRepository(db: DatabaseSync) {
  const all = db.prepare(`SELECT ${COLUMNS} FROM playlists ORDER BY id`);
  const one = db.prepare(`SELECT ${COLUMNS} FROM playlists WHERE id = ?`);
  const insert = db.prepare(
    "INSERT INTO playlists (name, kind, url, file_name, host, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const update = db.prepare("UPDATE playlists SET name = ?, url = ?, host = ?, enabled = ? WHERE id = ?");
  const remove = db.prepare("DELETE FROM playlists WHERE id = ?");
  const byUrl = db.prepare("SELECT id FROM playlists WHERE url = ?");
  const byFileName = db.prepare("SELECT id FROM playlists WHERE file_name = ?");
  const byName = db.prepare("SELECT id FROM playlists WHERE name = ? COLLATE NOCASE");

  const idOf = (row: unknown): number | undefined => (row === undefined ? undefined : IdRow.parse(row).id);

  return {
    list: (): PlaylistRecord[] => all.all().map(toPlaylist),
    find(id: number): PlaylistRecord | undefined {
      const row = one.get(id);
      return row === undefined ? undefined : toPlaylist(row);
    },
    /** The id of the playlist with exactly this web address, if any. */
    idOfUrl: (url: string): number | undefined => idOf(byUrl.get(url)),
    /** The id of the playlist made from a file of this (sanitised) name, if any. */
    idOfFileName: (fileName: string): number | undefined => idOf(byFileName.get(fileName)),
    /** The id of the playlist with this name, ignoring case, if any. */
    idOfName: (name: string): number | undefined => idOf(byName.get(name)),
    /** The `UNIQUE` columns decide a duplicate: a clash raises, and the service maps it to `409 playlist.taken`. */
    insert(p: NewPlaylist, at: number): number {
      const [url, fileName, host] = p.kind === "url" ? [p.url, null, p.host] : [null, p.fileName, null];
      return Number(insert.run(p.name, p.kind, url, fileName, host, p.enabled ? 1 : 0, at).lastInsertRowid);
    },
    update(p: { id: number; name: string; url?: string; host?: string; enabled: boolean }): void {
      update.run(p.name, p.url ?? null, p.host ?? null, p.enabled ? 1 : 0, p.id);
    },
    remove(id: number): boolean {
      return Number(remove.run(id).changes) > 0;
    },
  };
}

export type PlaylistRepository = ReturnType<typeof createPlaylistRepository>;
