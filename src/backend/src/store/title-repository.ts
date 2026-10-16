import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

/** A stored title: the `7.4` answer plus its freshness facts (docs/03 section 7.6b). */
export interface StoredTitle {
  kind: "movie" | "tv";
  tmdbId: number;
  payload: unknown;
  popularityScore: number | null;
  popularityReadAt: number | null;
  fetchedAt: number;
}

const TitleRow = z.object({
  kind: z.string(),
  tmdb_id: z.number(),
  payload: z.string(),
  popularity_score: z.number().nullable(),
  popularity_read_at: z.number().nullable(),
  fetched_at: z.number(),
});

const ListRow = z.object({
  ids: z.string(),
  total_pages: z.number(),
  total_results: z.number(),
  fetched_at: z.number(),
});

function stored(row: z.infer<typeof TitleRow>): StoredTitle {
  const kind = row.kind === "tv" ? "tv" : "movie";
  return {
    kind,
    tmdbId: row.tmdb_id,
    payload: JSON.parse(row.payload) as unknown,
    popularityScore: row.popularity_score,
    popularityReadAt: row.popularity_read_at,
    fetchedAt: row.fetched_at,
  };
}

/**
 * The title store (docs/03 section 7.6b): `titles` and `title_lists`. Written whole on every sync or
 * fill-through; read by the title routes and the sync status.
 */
export function createTitleRepository(db: DatabaseSync) {
  const one = db.prepare(
    "SELECT kind, tmdb_id, payload, popularity_score, popularity_read_at, fetched_at FROM titles WHERE kind = ? AND tmdb_id = ?",
  );
  const upsert = db.prepare(`
    INSERT INTO titles (kind, tmdb_id, payload, popularity_score, popularity_read_at, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (kind, tmdb_id) DO UPDATE SET
      payload = excluded.payload,
      popularity_score = COALESCE(excluded.popularity_score, titles.popularity_score),
      popularity_read_at = COALESCE(excluded.popularity_read_at, titles.popularity_read_at),
      fetched_at = excluded.fetched_at`);
  const oneList = db.prepare("SELECT ids, total_pages, total_results, fetched_at FROM title_lists WHERE key = ?");
  const upsertList = db.prepare(`
    INSERT INTO title_lists (key, ids, total_pages, total_results, fetched_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (key) DO UPDATE SET
      ids = excluded.ids, total_pages = excluded.total_pages,
      total_results = excluded.total_results, fetched_at = excluded.fetched_at`);
  const counts = db.prepare(
    "SELECT COUNT(*) AS total, SUM(fetched_at < ?) AS stale FROM titles",
  );

  return {
    /** The stored title, or undefined. */
    find(kind: "movie" | "tv", tmdbId: number): StoredTitle | undefined {
      const row = one.get(kind, tmdbId);
      return row === undefined ? undefined : stored(TitleRow.parse(row));
    },
    put(title: StoredTitle): void {
      upsert.run(
        title.kind,
        title.tmdbId,
        JSON.stringify(title.payload),
        title.popularityScore,
        title.popularityReadAt,
        title.fetchedAt,
      );
    },
    /** A stored list answer: its title ids in order, or undefined. */
    findList(key: string): { ids: number[]; totalPages: number; totalResults: number; fetchedAt: number } | undefined {
      const row = oneList.get(key);
      if (row === undefined) return undefined;
      const parsed = ListRow.parse(row);
      return {
        ids: (JSON.parse(parsed.ids) as unknown as unknown[]).map(Number),
        totalPages: parsed.total_pages,
        totalResults: parsed.total_results,
        fetchedAt: parsed.fetched_at,
      };
    },
    putList(key: string, ids: number[], totalPages: number, totalResults: number, fetchedAt: number): void {
      upsertList.run(key, JSON.stringify(ids), totalPages, totalResults, fetchedAt);
    },
    /** `{ total, stale }` against the freshness age, for the sync status. */
    counts(staleAgeMs: number): { total: number; stale: number } {
      const row = z.object({ total: z.number(), stale: z.number().nullable() }).parse(counts.get(staleAgeMs));
      return { total: row.total, stale: row.stale ?? 0 };
    },
  };
}

export type TitleRepository = ReturnType<typeof createTitleRepository>;
