-- migrate: backup
-- 029-channel-status-online-offline (docs/51 decisions 1 and 2): the channel-health words rename live/dead to
-- online/offline. The `status` CHECK is rebuilt with ('online', 'offline') and the stored values are mapped
-- (live -> online, dead -> offline; NULL = not checked stays NULL, and stays a kind = 'stream' word only).
-- The stored `jobs.last_counts` JSON keys are renamed the same way, only where each key is present; a failed
-- run's `{ code }` and a catalog run's counts are untouched. Audit rows are history: a `channel.status.set`
-- detail keeps the words it was written with.

-- Dropping `channels` cascades into channel_videos (008), so the videos are parked and restored, as 022 did.
CREATE TEMP TABLE channel_videos_keep AS SELECT * FROM channel_videos;

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
  status          TEXT CHECK (status IN ('online', 'offline')),
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
  live_mode, live_captions, live_variants, live_folder, edited_fields, sync_name, enabled, playlist_id,
  status, checked_at, logo_file, logo_checked_at)
SELECT id, name, category, number, logo_url, stream_url, revision, created_at, tvg_id, kind,
  live_mode, live_captions, live_variants, live_folder, edited_fields, sync_name, enabled, playlist_id,
  CASE status WHEN 'live' THEN 'online' WHEN 'dead' THEN 'offline' ELSE status END,
  checked_at, logo_file, logo_checked_at
FROM channels;

DROP TABLE channels;
ALTER TABLE channels_next RENAME TO channels;

CREATE UNIQUE INDEX channels_live_number ON channels (number) WHERE kind = 'live';
CREATE INDEX channels_playlist ON channels (playlist_id);

INSERT INTO channel_videos SELECT * FROM channel_videos_keep;
DROP TABLE channel_videos_keep;

-- The run counts' verdict keys are renamed too, each only where it is present: a failed run's `{ code }` and a
-- catalog run's `{ titles, stale, ... }` hold neither key and pass through untouched.
UPDATE sync_jobs
SET last_counts = json_remove(json_set(last_counts, '$.online', json_extract(last_counts, '$.live')), '$.live')
WHERE json_valid(last_counts) AND json_extract(last_counts, '$.live') IS NOT NULL;

UPDATE sync_jobs
SET last_counts = json_remove(json_set(last_counts, '$.offline', json_extract(last_counts, '$.dead')), '$.dead')
WHERE json_valid(last_counts) AND json_extract(last_counts, '$.dead') IS NOT NULL;
