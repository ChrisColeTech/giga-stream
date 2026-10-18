-- migrate: backup
-- 022-playlist-model: the playlist model of docs/43 section 6. A playlist is a file or a web address with real columns;
-- a channel's parent and a job's parent are foreign keys with ON DELETE CASCADE (foreign keys are ON), so deleting a
-- playlist removes its channels and its sync job. `channels.source` goes (the wire field is derived from the join), and
-- the sync-owned columns `status`, `checked_at`, `logo_file`, `logo_checked_at` arrive NULL (not checked yet).
-- The order matters: adding a cascading reference and then dropping the parent table would cascade. Each table is
-- rebuilt only after every table that will reference it has no reference yet (playlists, then sync_jobs, then channels).

-- 1. playlists: nothing references it yet.
CREATE TABLE playlists_next (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL COLLATE NOCASE UNIQUE,
  kind       TEXT NOT NULL CHECK (kind IN ('file', 'url')),
  url        TEXT UNIQUE,
  file_name  TEXT UNIQUE,
  host       TEXT,
  enabled    INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL,
  CHECK (
    (kind = 'url' AND url IS NOT NULL AND host IS NOT NULL AND file_name IS NULL)
    OR (kind = 'file' AND file_name IS NOT NULL AND url IS NULL AND host IS NULL)
  )
);

-- Explicit ids keep every old id. A clashing name gets ' (2)', ' (3)' by its order; a repeated address keeps the first.
INSERT INTO playlists_next (id, name, kind, url, file_name, host, enabled, created_at)
SELECT p.id,
  CASE WHEN ROW_NUMBER() OVER (PARTITION BY lower(p.name) ORDER BY p.id) = 1 THEN p.name
       ELSE p.name || ' (' || ROW_NUMBER() OVER (PARTITION BY lower(p.name) ORDER BY p.id) || ')' END,
  CASE WHEN p.address LIKE 'stored:%' THEN 'file' ELSE 'url' END,
  CASE WHEN p.address LIKE 'stored:%' THEN NULL ELSE p.address END,
  CASE WHEN p.address LIKE 'stored:%' THEN substr(p.address, 8) ELSE NULL END,
  CASE WHEN p.address LIKE 'stored:%' THEN NULL ELSE p.host END,
  p.enabled, p.created_at
FROM playlists p
WHERE p.id = (SELECT MIN(q.id) FROM playlists q WHERE q.address = p.address);

-- A deleted playlist's id is never reused: the new table continues the old one's counter.
UPDATE sqlite_sequence
SET seq = MAX(seq, COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'playlists'), 0))
WHERE name = 'playlists_next';

DROP TABLE playlists;
ALTER TABLE playlists_next RENAME TO playlists;

-- 2. sync_jobs: no children. A playlist job's old config names its playlist; the new table has the real column.
CREATE TEMP TABLE job_playlist AS
SELECT id,
  CASE WHEN type = 'playlist' AND json_valid(config)
    THEN (SELECT p.id FROM playlists p WHERE p.id = json_extract(sync_jobs.config, '$.playlistId')) END AS pid
FROM sync_jobs;

CREATE TABLE sync_jobs_next (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT,
  type        TEXT NOT NULL CHECK (type IN ('playlist', 'catalog')),
  enabled     INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  schedule    TEXT NOT NULL DEFAULT 'off',
  config      TEXT NOT NULL DEFAULT '{}',
  playlist_id INTEGER REFERENCES playlists (id) ON DELETE CASCADE,
  last_run_at INTEGER,
  last_result TEXT CHECK (last_result IS NULL OR last_result IN ('ok', 'failed', 'stopped')),
  last_counts TEXT,
  created_at  INTEGER NOT NULL,
  CHECK ((type = 'playlist') = (playlist_id IS NOT NULL)),
  CHECK ((type = 'catalog') = (name IS NOT NULL))
);

-- Playlist jobs: the lowest id per playlist; no stored name; never run (so the first pass follows the start grace);
-- the old results are obsolete; a schedule under 15 minutes is clamped to 15 minutes.
INSERT INTO sync_jobs_next (id, name, type, enabled, schedule, config, playlist_id, last_run_at, last_result, last_counts, created_at)
SELECT j.id, NULL, 'playlist', j.enabled,
  CASE WHEN j.schedule = 'off' THEN 'off'
       WHEN j.schedule GLOB '*ms' OR j.schedule GLOB '*[0-9]s' THEN '15m'
       WHEN j.schedule GLOB '*[0-9]m' AND CAST(j.schedule AS INTEGER) < 15 THEN '15m'
       ELSE j.schedule END,
  '{}', jp.pid, NULL, NULL, NULL, j.created_at
FROM sync_jobs j JOIN job_playlist jp ON jp.id = j.id
WHERE j.type = 'playlist' AND jp.pid IS NOT NULL
  AND j.id = (SELECT MIN(x.id) FROM job_playlist x WHERE x.pid = jp.pid);

-- Catalog jobs keep their run time; the result is ok or failed, the counts are typed.
INSERT INTO sync_jobs_next (id, name, type, enabled, schedule, config, playlist_id, last_run_at, last_result, last_counts, created_at)
SELECT id, name, 'catalog', enabled, schedule, config, NULL, last_run_at,
  CASE WHEN last_run_at IS NULL THEN NULL WHEN last_outcome = 'ok' THEN 'ok' ELSE 'failed' END,
  CASE WHEN last_run_at IS NULL THEN NULL
       WHEN last_outcome = 'ok' THEN json_object('titles',
         COALESCE(CASE WHEN json_valid(last_counts) THEN json_extract(last_counts, '$.titles') END, 0), 'stale', 0)
       ELSE json_object('code', 'internal.failure') END,
  created_at
FROM sync_jobs
WHERE type = 'catalog' AND json_valid(config);

-- Every playlist has exactly one job.
INSERT INTO sync_jobs_next (name, type, enabled, schedule, config, playlist_id, last_run_at, created_at)
SELECT NULL, 'playlist', 1, '24h', '{}', p.id, NULL, CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM playlists p
WHERE NOT EXISTS (SELECT 1 FROM sync_jobs_next j WHERE j.playlist_id = p.id);

CREATE UNIQUE INDEX sync_jobs_playlist ON sync_jobs_next (playlist_id) WHERE playlist_id IS NOT NULL;

UPDATE sqlite_sequence
SET seq = MAX(seq, COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'sync_jobs'), 0))
WHERE name = 'sync_jobs_next';

DROP TABLE sync_jobs;
ALTER TABLE sync_jobs_next RENAME TO sync_jobs;
DROP TABLE job_playlist;

-- 3. channels. Dropping it cascades into channel_videos (008), so the videos are kept aside and restored.
CREATE TEMP TABLE channel_videos_keep AS SELECT * FROM channel_videos;

UPDATE channels SET playlist_id = NULL WHERE kind = 'live';
UPDATE channels SET playlist_id = NULL
WHERE playlist_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM playlists p WHERE p.id = channels.playlist_id);

-- A row that lost its parent finds it again by its old `source` (a host, or 'stored:<file>') when exactly one matches.
UPDATE channels
SET playlist_id = (SELECT p.id FROM playlists p WHERE p.host = channels.source OR 'stored:' || p.file_name = channels.source)
WHERE playlist_id IS NULL AND source IS NOT NULL AND kind = 'stream'
  AND (SELECT COUNT(*) FROM playlists p WHERE p.host = channels.source OR 'stored:' || p.file_name = channels.source) = 1;

-- Anything still without a parent is hand-made: no sync name, no edit record.
UPDATE channels SET sync_name = NULL, edited_fields = NULL WHERE playlist_id IS NULL;

CREATE TABLE channels_next (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  number        TEXT,
  logo_url      TEXT,
  stream_url    TEXT,
  revision      INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,
  tvg_id        TEXT,
  kind          TEXT NOT NULL DEFAULT 'stream' CHECK (kind IN ('stream', 'live')),
  live_mode     TEXT CHECK (live_mode IN ('loop', 'encode')),
  live_captions INTEGER CHECK (live_captions IN (0, 1)),
  live_variants TEXT,
  live_folder   TEXT,
  edited_fields TEXT,
  sync_name     TEXT,
  enabled       INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  playlist_id   INTEGER REFERENCES playlists (id) ON DELETE CASCADE,
  status          TEXT CHECK (status IN ('live', 'dead')),
  checked_at      INTEGER,
  logo_file       TEXT,
  logo_checked_at INTEGER,
  CHECK (
    (kind = 'stream' AND stream_url IS NOT NULL AND live_mode IS NULL)
    OR (kind = 'live' AND stream_url IS NULL AND live_mode IS NOT NULL
        AND live_captions IS NOT NULL AND live_variants IS NOT NULL)
  ),
  CHECK (playlist_id IS NULL OR (kind = 'stream' AND sync_name IS NOT NULL)),
  CHECK (status IS NULL OR kind = 'stream')
);

INSERT INTO channels_next (id, name, category, number, logo_url, stream_url, revision, created_at, tvg_id, kind,
  live_mode, live_captions, live_variants, live_folder, edited_fields, sync_name, enabled, playlist_id)
SELECT id, name, category, number, logo_url, stream_url, revision, created_at, tvg_id, kind,
  live_mode, live_captions, live_variants, live_folder, edited_fields,
  CASE WHEN playlist_id IS NOT NULL THEN COALESCE(sync_name, name) ELSE sync_name END, enabled, playlist_id
FROM channels;

DROP TABLE channels;
ALTER TABLE channels_next RENAME TO channels;

CREATE UNIQUE INDEX channels_live_number ON channels (number) WHERE kind = 'live';
CREATE INDEX channels_playlist ON channels (playlist_id);

INSERT INTO channel_videos SELECT * FROM channel_videos_keep;
DROP TABLE channel_videos_keep;
