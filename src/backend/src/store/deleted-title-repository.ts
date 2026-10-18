import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

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

/**
 * The deleted synced titles (docs/03 section 7.4, migration 020): what browse, search, detail and the catalog sync
 * skip. A title made by hand is never recorded here.
 */
export function createDeletedTitleRepository(db: DatabaseSync) {
  const insert = db.prepare(`
    INSERT INTO deleted_titles (kind, tmdb_id, title, deleted_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (kind, tmdb_id) DO UPDATE SET title = COALESCE(excluded.title, title), deleted_at = excluded.deleted_at`);
  const exists = db.prepare("SELECT 1 AS found FROM deleted_titles WHERE kind = ? AND tmdb_id = ?");
  const all = db.prepare("SELECT kind, tmdb_id, title, deleted_at FROM deleted_titles ORDER BY deleted_at DESC, kind, tmdb_id");
  const remove = db.prepare("DELETE FROM deleted_titles WHERE kind = ? AND tmdb_id = ?");

  return {
    record(kind: "movie" | "tv", tmdbId: number, title: string | undefined, at: number): void {
      insert.run(kind, tmdbId, title ?? null, at);
    },
    has: (kind: "movie" | "tv", tmdbId: number): boolean => exists.get(kind, tmdbId) !== undefined,
    /** Every deleted title, the latest first. */
    list: (): DeletedTitle[] =>
      all.all().map((raw) => {
        const row = Row.parse(raw);
        return { kind: row.kind, tmdbId: row.tmdb_id, title: row.title ?? undefined, deletedAt: row.deleted_at };
      }),
    /** Removes the record; false when there was none. */
    restore: (kind: "movie" | "tv", tmdbId: number): boolean => Number(remove.run(kind, tmdbId).changes) > 0,
  };
}

export type DeletedTitleRepository = ReturnType<typeof createDeletedTitleRepository>;
