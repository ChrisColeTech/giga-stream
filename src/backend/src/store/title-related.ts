import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

import type { StoredTitle } from "./title-repository.js";

const GenreRow = z.object({ genre_id: z.number().int(), name: z.string() });

/** One genre of TMDB's dictionary. */
export interface Genre {
  id: number;
  name: string;
}

/**
 * What the public reads compute from the store alone (docs/47 sections 3.2 and 3.1): the stored genre dictionary
 * (replaced once per Library fill run) and a title's recommendations, the enabled titles of the same kind that share at
 * least one genre with it, most popular first, the title itself left out.
 */
export function createTitleRelated(db: DatabaseSync, columns: string, map: (row: unknown) => StoredTitle) {
  const genres = db.prepare("SELECT genre_id, name FROM title_genres WHERE kind = ? ORDER BY name, genre_id");
  const clear = db.prepare("DELETE FROM title_genres WHERE kind = ?");
  const insert = db.prepare("INSERT OR REPLACE INTO title_genres (kind, genre_id, name) VALUES (?, ?, ?)");
  const related = db.prepare(`
    SELECT ${columns} FROM titles o
    WHERE o.kind = ? AND o.id <> ? AND o.enabled = 1
      AND EXISTS (
        SELECT 1 FROM json_each(o.payload, '$.genres') og
        JOIN json_each((SELECT json_extract(payload, '$.genres') FROM titles WHERE id = ?)) mg ON og.value = mg.value)
    ORDER BY o.popularity_score DESC, o.id
    LIMIT ?`);

  return {
    genres(kind: "movie" | "tv"): Genre[] {
      return genres.all(kind).map((row) => {
        const parsed = GenreRow.parse(row);
        return { id: parsed.genre_id, name: parsed.name };
      });
    },
    /** Replaces one kind's dictionary whole; the caller wraps it in a transaction with the other kind if it wants. */
    replaceGenres(kind: "movie" | "tv", list: readonly Genre[]): void {
      clear.run(kind);
      for (const genre of list) insert.run(kind, genre.id, genre.name);
    },
    recommendations(title: { id: string; kind: "movie" | "tv" }, limit: number): StoredTitle[] {
      return related.all(title.kind, title.id, title.id, limit).map(map);
    },
  };
}
