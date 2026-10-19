import { z } from "zod";

import type { Database } from "./database.js";

/** A title the details phase still has to fetch, in the order it is fetched. */
export interface PendingDetail {
  id: string;
  kind: "movie" | "tv";
  tmdbId: number;
}

const DetailRow = z.object({ id: z.string(), kind: z.enum(["movie", "tv"]), tmdb_id: z.number().int() });

/**
 * The OMDb gap condition (`11` section 7.3), alias `t`, shared with the Library update's queue (`title-update-queue.ts`).
 * Three placeholders: OMDb on (1 or 0), the freshness window of an `omdb` block and of a recorded miss.
 */
export const OMDB_GAP_SQL = `(? = 1 AND json_extract(t.payload, '$.shape') = 'detail'
          AND json_extract(t.payload, '$.imdbId') IS NOT NULL
          AND COALESCE(json_extract(t.payload, '$.omdb.fetchedAt'), 0) < ? AND COALESCE(t.omdb_failed_at, 0) < ?
          AND (
            (COALESCE(json_extract(t.payload, '$.plot'), '') = '' AND COALESCE(t.edited_fields, '') NOT LIKE '%"plot"%')
            OR (t.kind = 'movie' AND COALESCE(json_extract(t.payload, '$.runtimeMs'), 0) <= 0
              AND COALESCE(t.edited_fields, '') NOT LIKE '%"runtimeMs"%')
            OR (COALESCE(json_array_length(t.payload, '$.genres'), 0) = 0
              AND COALESCE(t.edited_fields, '') NOT LIKE '%"genres"%')
            OR (COALESCE(json_extract(t.payload, '$.rating'), 0) <= 0
              AND COALESCE(t.edited_fields, '') NOT LIKE '%"rating"%')))`;

const PENDING_SQL = `
  SELECT t.id AS id, t.kind AS kind, t.tmdb_id AS tmdb_id FROM titles t
  WHERE t.origin = 'tmdb' AND t.enabled = 1 AND t.tmdb_id IS NOT NULL
    AND COALESCE(t.detail_failures, 0) < ?
    AND (
      COALESCE(json_extract(t.payload, '$.shape'), 'list') <> 'detail' OR t.fetched_at < ?
      OR (t.kind = 'tv' AND (t.edited_fields IS NULL OR t.edited_fields NOT LIKE '%"seasons"%') AND EXISTS (
        SELECT 1 FROM json_each(t.payload, '$.seasons') s
        WHERE json_extract(s.value, '$.season') >= 1
          AND (json_extract(s.value, '$.episodesAt') IS NULL OR json_extract(s.value, '$.episodesAt') < ?)))
      OR ${OMDB_GAP_SQL}
    )
  ORDER BY t.popularity_score DESC, t.id`;

/**
 * The Library fill's work queue (docs/47 section 3.1), answered by QUERY so a stopped run resumes with what is still
 * missing: a title whose payload is a list row, a detail read before `staleBefore`, or a series whose detail stands but
 * has a season (not the specials) with no episodes stored or stored before `staleBefore`. Highest popularity first. A
 * title that failed `maxFailures` runs in a row is left out until its payload changes (the repository's upsert clears
 * the record; a good fetch clears it too). With OMDb on, a detail with an IMDb id, a gap (no plot, no movie runtime, no
 * genres, no rating; none of them an admin-edited field) and no (or a stale) `omdb` block is queued too, unless OMDb
 * missed it within the window (`omdb_failed_at`). Disabled titles and titles made by hand are never queued, nor are the
 * seasons of a series whose `seasons` an admin edited.
 */
export function createTitleDetails(db: Database) {
  const SQL = {
    pending: PENDING_SQL,
    failDetail: "UPDATE titles SET detail_failed_at = ?, detail_failures = COALESCE(detail_failures, 0) + 1 WHERE id = ?",
    clearDetail: "UPDATE titles SET detail_failed_at = NULL, detail_failures = NULL WHERE id = ?",
    missedAt: "SELECT omdb_failed_at AS at FROM titles WHERE id = ?",
    setOmdbFailure: "UPDATE titles SET omdb_failed_at = ? WHERE id = ?",
  };

  return {
    /** `withOmdb`: also the details with an IMDb id and no OMDb block, or one read before `staleBefore` (not a recent miss). */
    async pendingDetails(staleBefore: number, maxFailures: number, withOmdb: boolean): Promise<PendingDetail[]> {
      const rows = (await db.execute({
        sql: SQL.pending,
        args: [maxFailures, staleBefore, staleBefore, withOmdb ? 1 : 0, staleBefore, staleBefore],
      })).rows;
      return rows.map((row) => {
        const parsed = DetailRow.parse(row);
        return { id: parsed.id, kind: parsed.kind, tmdbId: parsed.tmdb_id };
      });
    },
    noteDetailFailure: async (id: string, at: number): Promise<void> => {
      await db.execute({ sql: SQL.failDetail, args: [at, id] });
    },
    clearDetailFailure: async (id: string): Promise<void> => {
      await db.execute({ sql: SQL.clearDetail, args: [id] });
    },
    /** When OMDb last missed this title, or 0. */
    omdbFailedAt: async (id: string): Promise<number> => {
      const row = (await db.execute({ sql: SQL.missedAt, args: [id] })).rows[0];
      return typeof row?.at === "number" ? row.at : 0;
    },
    /** OMDb did not know this title: when, or null once it has an OMDb block. */
    setOmdbFailure: async (id: string, at: number | null): Promise<void> => {
      await db.execute({ sql: SQL.setOmdbFailure, args: [at, id] });
    },
  };
}

export type TitleDetails = ReturnType<typeof createTitleDetails>;
