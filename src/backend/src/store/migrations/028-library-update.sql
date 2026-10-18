-- 028-library-update (docs/49 sections 2.4 and 2.7): the Library update is an incremental catalog job (scope 'recent').
-- `cursor_at` is where its next airing window starts: written only by a run that ended `ok` (to that run's start minus
-- an hour), never by `last_run_at`, which also moves on a stopped or failed run. Nullable: every job is kept as it was.
-- The job itself is made only on a database whose first-start seed already ran (a fresh database leaves it to the seed,
-- which would otherwise make a second one) and that has no 'recent' job yet; the migration runs once, so a job the admin
-- deletes stays deleted. Same guards as 025: the CASE keeps json_extract off a config that is not JSON.

ALTER TABLE sync_jobs ADD COLUMN cursor_at INTEGER;

INSERT INTO sync_jobs (name, type, enabled, schedule, config, playlist_id, last_result, created_at)
SELECT 'Library update', 'catalog', 1, '24h', '{"scope":"recent","pages":1}', NULL, NULL,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE EXISTS (SELECT 1 FROM sync_seed)
  AND NOT EXISTS (
    SELECT 1 FROM sync_jobs
    WHERE type = 'catalog' AND json_valid(config)
      AND CASE WHEN json_valid(config) THEN json_extract(config, '$.scope') END = 'recent'
  );
