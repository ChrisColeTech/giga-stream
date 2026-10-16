-- 001-init: every table of docs/02 section 7.1. Later pieces fill them in without schema changes.
-- Times are Unix milliseconds. JSON columns hold validated JSON text. Private local paths live
-- only in collection_folders.path and local_files.path and never leave the fileserver.

-- Product settings, one validated JSON value per key (pane layout and window state are separate).
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- The single shell record: active surface, pane visibility/sizes, window bounds.
CREATE TABLE shell_state (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- One admin-backend target. Never holds a credential.
CREATE TABLE admin_target (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  mode       TEXT NOT NULL CHECK (mode IN ('local', 'lan', 'cloud')),
  base_url   TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- The last publication revision applied locally.
CREATE TABLE admin_sync (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  revision   INTEGER NOT NULL DEFAULT 0,
  synced_at  INTEGER
);

-- Synchronized public runtime provider definitions (built-in revision 0 seeds included).
CREATE TABLE provider_definitions (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  adapter            TEXT NOT NULL,
  base_url           TEXT NOT NULL,
  capabilities       TEXT NOT NULL,
  config             TEXT NOT NULL DEFAULT '{}',
  enabled_by_default INTEGER NOT NULL DEFAULT 1,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  revision           INTEGER NOT NULL DEFAULT 0,
  removed            INTEGER NOT NULL DEFAULT 0
);

-- Local enablement and health; survives definition synchronization.
CREATE TABLE provider_health (
  provider_id     TEXT PRIMARY KEY REFERENCES provider_definitions (id) ON DELETE CASCADE,
  enabled         INTEGER NOT NULL DEFAULT 1,
  state           TEXT NOT NULL DEFAULT 'unknown' CHECK (state IN ('up', 'down', 'unknown', 'cooldown')),
  failures        INTEGER NOT NULL DEFAULT 0,
  last_checked_at INTEGER,
  last_ok_at      INTEGER,
  cooldown_until  INTEGER,
  error_code      TEXT,
  error_message   TEXT
);

-- Normalized provider/admin title cache. Eviction never touches watch, favorites or collections.
CREATE TABLE titles (
  id                  TEXT PRIMARY KEY,
  imdb_id             TEXT,
  tmdb_id             TEXT,
  kind                TEXT NOT NULL CHECK (kind IN ('movie', 'tv')),
  title               TEXT NOT NULL,
  year                INTEGER,
  poster_id           TEXT,
  backdrop_id         TEXT,
  plot                TEXT,
  rating              REAL,
  genres              TEXT NOT NULL DEFAULT '[]',
  cast_names          TEXT NOT NULL DEFAULT '[]',
  quality             TEXT,
  runtime_ms          INTEGER,
  popularity_score    REAL,
  popularity_source   TEXT,
  popularity_as_of    INTEGER,
  provider_ids        TEXT NOT NULL DEFAULT '[]',
  source              TEXT NOT NULL DEFAULT 'provider' CHECK (source IN ('admin', 'provider')),
  metadata_revision   INTEGER NOT NULL DEFAULT 0,
  cached_at           INTEGER NOT NULL
);
CREATE INDEX idx_titles_kind_year ON titles (kind, year);
CREATE INDEX idx_titles_title ON titles (title COLLATE NOCASE);

CREATE TABLE episodes (
  id        TEXT PRIMARY KEY,
  title_id  TEXT NOT NULL REFERENCES titles (id) ON DELETE CASCADE,
  season    INTEGER NOT NULL,
  episode   INTEGER NOT NULL,
  title     TEXT,
  still_id  TEXT,
  air_date  TEXT,
  UNIQUE (title_id, season, episode)
);

CREATE TABLE collections (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Manual membership. item_id is a title id or a local file id depending on item_kind.
CREATE TABLE collection_items (
  id            TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
  item_kind     TEXT NOT NULL CHECK (item_kind IN ('title', 'local')),
  item_id       TEXT NOT NULL,
  added_at      INTEGER NOT NULL,
  UNIQUE (collection_id, item_kind, item_id)
);
CREATE INDEX idx_collection_items_item ON collection_items (item_kind, item_id);

-- Private folder attachments. path is a private local path.
CREATE TABLE collection_folders (
  id              TEXT PRIMARY KEY,
  collection_id   TEXT NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
  path            TEXT NOT NULL,
  name            TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  last_scanned_at INTEGER
);
CREATE INDEX idx_collection_folders_collection ON collection_folders (collection_id);

-- Indexed media files discovered through a folder attachment. path is a private local path.
CREATE TABLE local_files (
  id                  TEXT PRIMARY KEY,
  folder_id           TEXT NOT NULL REFERENCES collection_folders (id) ON DELETE CASCADE,
  collection_id       TEXT NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
  path                TEXT NOT NULL,
  title               TEXT NOT NULL,
  size_bytes          INTEGER,
  mtime_ms            INTEGER,
  duration_ms         INTEGER,
  width               INTEGER,
  height              INTEGER,
  video_codec         TEXT,
  audio_codec         TEXT,
  container           TEXT,
  playable            INTEGER NOT NULL DEFAULT 1,
  probe_error_code    TEXT,
  probe_error_message TEXT,
  poster_id           TEXT,
  added_at            INTEGER NOT NULL,
  UNIQUE (folder_id, path)
);
CREATE INDEX idx_local_files_collection ON local_files (collection_id);

CREATE TABLE favorites (
  item_kind TEXT NOT NULL CHECK (item_kind IN ('title', 'local')),
  item_id   TEXT NOT NULL,
  added_at  INTEGER NOT NULL,
  PRIMARY KEY (item_kind, item_id)
);

-- Watch history. Channels never create rows. season/episode are NULL for movies and local files.
CREATE TABLE watch_entries (
  id          TEXT PRIMARY KEY,
  item_kind   TEXT NOT NULL CHECK (item_kind IN ('title', 'local')),
  item_id     TEXT NOT NULL,
  season      INTEGER,
  episode     INTEGER,
  position_ms INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  state       TEXT NOT NULL CHECK (state IN ('watching', 'watched')),
  source      TEXT,
  updated_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_watch_identity
  ON watch_entries (item_kind, item_id, COALESCE(season, -1), COALESCE(episode, -1));
CREATE INDEX idx_watch_updated ON watch_entries (updated_at DESC);

-- Synchronized published channels. manifest_url is server-only and never reaches a DTO.
CREATE TABLE channels (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  logo_id      TEXT,
  category     TEXT NOT NULL,
  number       TEXT,
  manifest_url TEXT NOT NULL,
  relay_allowed INTEGER NOT NULL DEFAULT 0,
  revision     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_channels_category ON channels (category);

CREATE TABLE channel_state (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  last_channel_id TEXT
);

-- Persisted jobs. request holds identifiers only, never a path.
CREATE TABLE jobs (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL
    CHECK (kind IN ('catalog-sync', 'provider-check', 'folder-scan', 'media-probe', 'poster-fetch')),
  label         TEXT NOT NULL,
  state         TEXT NOT NULL
    CHECK (state IN ('queued', 'running', 'cancelling', 'done', 'failed', 'cancelled', 'interrupted')),
  percent       REAL,
  error_code    TEXT,
  error_message TEXT,
  request       TEXT NOT NULL DEFAULT 'null',
  created_at    INTEGER NOT NULL,
  started_at    INTEGER,
  finished_at   INTEGER
);
CREATE INDEX idx_jobs_created ON jobs (created_at DESC);

-- Short-lived playback identity, resume point and descriptor facts.
CREATE TABLE playback_sessions (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('title', 'channel', 'local')),
  identity     TEXT NOT NULL,
  resume_at_ms INTEGER NOT NULL DEFAULT 0,
  descriptor   TEXT NOT NULL,
  revision     INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  closed_at    INTEGER
);
CREATE INDEX idx_playback_sessions_expiry ON playback_sessions (expires_at);

-- Short-lived relay target graph minted by resolution; never built from client input.
CREATE TABLE relay_sessions (
  id          TEXT PRIMARY KEY,
  playback_id TEXT NOT NULL REFERENCES playback_sessions (id) ON DELETE CASCADE,
  graph       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX idx_relay_sessions_expiry ON relay_sessions (expires_at);
