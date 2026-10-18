import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

import { OMDB_GAP_SQL, type PendingDetail } from "./title-details.js";

/** A title the Library update's `refresh` phase fetches: forced when TMDB's `/changes` listed it (`49` section 2.2). */
export interface RefreshItem extends PendingDetail {
  force: boolean;
}

const RefreshRow = z.object({
  id: z.string(), kind: z.enum(["movie", "tv"]), tmdb_id: z.number().int(), forced: z.number().int(),
});

const IdRow = z.object({ tmdb_id: z.number().int() });

/**
 * The Library update's two store questions (`49` section 2), both set-based: the ids bound as ONE `json_each(?)` text,
 * never an `IN (...)` list, so a window of tens of thousands of ids is one statement.
 *
 * `storedAmong`: of the TMDB ids a `/changes` window listed, the ones this store holds as a TMDB title that is enabled
 * and not deleted (an admin's deletion is kept in `deleted_titles`).
 *
 * `refreshQueue`: the update's work, highest popularity first: a list-shaped title, a series whose detail stands but has
 * a season (not the specials) with no episodes stored, a title in `changed` (title ids, forced), and with OMDb on a gap
 * the OMDb step fills. There is NO age clause: staleness is what `changes` replaces. A title that failed `maxFailures`
 * runs in a row is left out, forced or not. Disabled titles and titles made by hand are never queued, nor are the
 * seasons of a series whose `seasons` an admin edited.
 */
export function createTitleUpdateQueue(db: DatabaseSync) {
  const among = db.prepare(`
    SELECT t.tmdb_id AS tmdb_id FROM titles t
    WHERE t.kind = ? AND t.origin = 'tmdb' AND t.enabled = 1
      AND t.tmdb_id IN (SELECT value FROM json_each(?))
      AND NOT EXISTS (SELECT 1 FROM deleted_titles d WHERE d.kind = t.kind AND d.tmdb_id = t.tmdb_id)`);
  const refresh = db.prepare(`
    WITH changed(id) AS (SELECT value FROM json_each(?))
    SELECT t.id AS id, t.kind AS kind, t.tmdb_id AS tmdb_id, t.id IN (SELECT id FROM changed) AS forced FROM titles t
    WHERE t.origin = 'tmdb' AND t.enabled = 1 AND t.tmdb_id IS NOT NULL
      AND COALESCE(t.detail_failures, 0) < ?
      AND (
        COALESCE(json_extract(t.payload, '$.shape'), 'list') <> 'detail'
        OR t.id IN (SELECT id FROM changed)
        OR (t.kind = 'tv' AND (t.edited_fields IS NULL OR t.edited_fields NOT LIKE '%"seasons"%') AND EXISTS (
          SELECT 1 FROM json_each(t.payload, '$.seasons') s
          WHERE json_extract(s.value, '$.season') >= 1 AND json_extract(s.value, '$.episodesAt') IS NULL))
        OR ${OMDB_GAP_SQL}
      )
    ORDER BY t.popularity_score DESC, t.id`);

  return {
    /** The ids of `ids` that are stored, enabled, TMDB titles of `kind` and not deleted. */
    storedAmong(kind: "movie" | "tv", ids: readonly number[]): number[] {
      if (ids.length === 0) return [];
      return among.all(kind, JSON.stringify(ids)).map((row) => IdRow.parse(row).tmdb_id);
    },
    /** `omdbStaleBefore`: an `omdb` block or a recorded miss newer than this keeps a gap title out. */
    refreshQueue(
      changed: readonly string[], maxFailures: number, withOmdb: boolean, omdbStaleBefore: number,
    ): RefreshItem[] {
      const omdb = withOmdb ? 1 : 0;
      const rows = refresh.all(JSON.stringify(changed), maxFailures, omdb, omdbStaleBefore, omdbStaleBefore);
      return rows.map((row) => {
        const parsed = RefreshRow.parse(row);
        return { id: parsed.id, kind: parsed.kind, tmdbId: parsed.tmdb_id, force: parsed.forced === 1 };
      });
    },
  };
}

export type TitleUpdateQueue = ReturnType<typeof createTitleUpdateQueue>;
