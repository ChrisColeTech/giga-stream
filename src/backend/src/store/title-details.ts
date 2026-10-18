import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

/** A title the details phase still has to fetch, in the order it is fetched. */
export interface PendingDetail {
  id: string;
  kind: "movie" | "tv";
  tmdbId: number;
}

const DetailRow = z.object({ id: z.string(), kind: z.enum(["movie", "tv"]), tmdb_id: z.number().int() });

/**
 * The Library fill's work queue (docs/47 section 3.1), answered by QUERY so a stopped run resumes with what is still
 * missing: a title whose payload is a list row, a detail read before `staleBefore`, or a series whose detail stands but
 * has a season (not the specials) with no episodes stored or stored before `staleBefore`. Highest popularity first. A
 * title that failed `maxFailures` runs in a row is left out until its payload changes (the repository's upsert clears
 * the record; a good fetch clears it too). Disabled titles and titles made by hand are never queued, nor are the seasons
 * of a series whose `seasons` an admin edited.
 */
export function createTitleDetails(db: DatabaseSync) {
  const pending = db.prepare(`
    SELECT t.id AS id, t.kind AS kind, t.tmdb_id AS tmdb_id FROM titles t
    WHERE t.origin = 'tmdb' AND t.enabled = 1 AND t.tmdb_id IS NOT NULL
      AND COALESCE(t.detail_failures, 0) < ?
      AND (
        COALESCE(json_extract(t.payload, '$.shape'), 'list') <> 'detail' OR t.fetched_at < ?
        OR (t.kind = 'tv' AND (t.edited_fields IS NULL OR t.edited_fields NOT LIKE '%"seasons"%') AND EXISTS (
          SELECT 1 FROM json_each(t.payload, '$.seasons') s
          WHERE json_extract(s.value, '$.season') >= 1
            AND (json_extract(s.value, '$.episodesAt') IS NULL OR json_extract(s.value, '$.episodesAt') < ?)))
      )
    ORDER BY t.popularity_score DESC, t.id`);
  const failDetail = db.prepare(
    "UPDATE titles SET detail_failed_at = ?, detail_failures = COALESCE(detail_failures, 0) + 1 WHERE id = ?");
  const clearDetail = db.prepare("UPDATE titles SET detail_failed_at = NULL, detail_failures = NULL WHERE id = ?");

  return {
    pendingDetails(staleBefore: number, maxFailures: number): PendingDetail[] {
      return pending.all(maxFailures, staleBefore, staleBefore).map((row) => {
        const parsed = DetailRow.parse(row);
        return { id: parsed.id, kind: parsed.kind, tmdbId: parsed.tmdb_id };
      });
    },
    noteDetailFailure(id: string, at: number): void {
      failDetail.run(at, id);
    },
    clearDetailFailure(id: string): void {
      clearDetail.run(id);
    },
  };
}

export type TitleDetails = ReturnType<typeof createTitleDetails>;
