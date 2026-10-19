import { z } from "zod";

import type { Database } from "./database.js";

/** A deleted synced title: its TMDB identity, the last known title text and when it was deleted. */
export interface DeletedTitle {
  kind: "movie" | "tv";
  tmdbId: number;
  title: string | undefined;
  deletedAt: number;
}

const Row = z.object({
  kind: z.enum(["movie", "tv"]),
  tmdb_id: z.number().int(),
  title: z.string().nullable(),
  deleted_at: z.number(),
});

const SQL = {
  insert: `
    INSERT INTO deleted_titles (kind, tmdb_id, title, deleted_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (kind, tmdb_id) DO UPDATE SET title = COALESCE(excluded.title, title), deleted_at = excluded.deleted_at`,
  exists: "SELECT 1 AS found FROM deleted_titles WHERE kind = ? AND tmdb_id = ?",
  all: "SELECT kind, tmdb_id, title, deleted_at FROM deleted_titles ORDER BY deleted_at DESC, kind, tmdb_id",
  remove: "DELETE FROM deleted_titles WHERE kind = ? AND tmdb_id = ?",
};

/**
 * The deleted synced titles (docs/03 section 7.4, migration 020): what browse, search, detail and the catalog sync
 * skip. A title made by hand is never recorded here.
 */
export function createDeletedTitleRepository(db: Database) {
  return {
    record: async (kind: "movie" | "tv", tmdbId: number, title: string | undefined, at: number): Promise<void> => {
      await db.execute({ sql: SQL.insert, args: [kind, tmdbId, title ?? null, at] });
    },
    has: async (kind: "movie" | "tv", tmdbId: number): Promise<boolean> =>
      (await db.execute({ sql: SQL.exists, args: [kind, tmdbId] })).rows[0] !== undefined,
    /** Every deleted title, the latest first. */
    list: async (): Promise<DeletedTitle[]> =>
      (await db.execute(SQL.all)).rows.map((raw) => {
        const row = Row.parse(raw);
        return { kind: row.kind, tmdbId: row.tmdb_id, title: row.title ?? undefined, deletedAt: row.deleted_at };
      }),
    /** Removes the record; false when there was none. */
    restore: async (kind: "movie" | "tv", tmdbId: number): Promise<boolean> =>
      (await db.execute({ sql: SQL.remove, args: [kind, tmdbId] })).rowsAffected > 0,
  };
}

export type DeletedTitleRepository = ReturnType<typeof createDeletedTitleRepository>;
