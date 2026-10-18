-- 025-library-fill (docs/44 section 3.4): the four per-slice catalog jobs were retired by the owner (2026-10-17) and
-- replaced by one Library fill (scope 'discover'), but a database seeded before that never lost the old jobs and never
-- got the new one. Only the retired SEEDED jobs go (by name and scope: a job the owner renamed is kept). The Library
-- fill is made only on a database whose first-start seed already ran (a fresh database leaves it to the seed, which
-- would otherwise make a second one) and that has no discover job yet. The CASE keeps json_extract off a config that
-- is not JSON (SQLite does not promise to stop at the first false term of an AND).

DELETE FROM sync_jobs
WHERE type = 'catalog'
  AND name IN ('Trending movies', 'Trending series', 'Popular movies', 'Popular series')
  AND json_valid(config)
  AND CASE WHEN json_valid(config) THEN json_extract(config, '$.scope') END IN ('trending', 'popular');

INSERT INTO sync_jobs (name, type, enabled, schedule, config, playlist_id, last_result, created_at)
SELECT 'Library fill', 'catalog', 1, 'off', '{"scope":"discover","pages":500}', NULL, NULL,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE EXISTS (SELECT 1 FROM sync_seed)
  AND NOT EXISTS (
    SELECT 1 FROM sync_jobs
    WHERE type = 'catalog' AND json_valid(config)
      AND CASE WHEN json_valid(config) THEN json_extract(config, '$.scope') END = 'discover'
  );
