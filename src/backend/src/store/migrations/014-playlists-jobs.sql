-- 014-playlists-jobs: playlists and sync jobs are records an admin manages (docs/26 section 3.11).
-- A playlist's `address` is a secret (it can carry credentials in its query): no read returns it, and an audit
-- entry holds its host only; `host` is kept beside it for display. `channels.playlist_id` says which playlist
-- created or last updated a synced row, so a playlist can count its channels and, when deleted, release them.
-- A job's `config` is JSON: { playlistId, dryRun, prune } for type 'playlist', { scope, kind, pages } for 'catalog'.
-- `sync_seed` records that the environment has seeded the first playlists and jobs, so it never does again.

CREATE TABLE playlists (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  address        TEXT NOT NULL,
  host           TEXT NOT NULL,
  enabled        INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  last_synced_at INTEGER,
  last_outcome   TEXT,
  created_at     INTEGER NOT NULL
);

CREATE TABLE sync_jobs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('playlist', 'catalog')),
  enabled      INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  schedule     TEXT NOT NULL DEFAULT 'off',
  config       TEXT NOT NULL,
  last_run_at  INTEGER,
  last_outcome TEXT,
  last_counts  TEXT,
  created_at   INTEGER NOT NULL
);

CREATE TABLE sync_seed (
  id        INTEGER PRIMARY KEY CHECK (id = 1),
  seeded_at INTEGER NOT NULL
);

ALTER TABLE channels ADD COLUMN playlist_id INTEGER;
