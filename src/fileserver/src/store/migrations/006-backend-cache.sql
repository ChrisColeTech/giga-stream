-- 006-backend-cache (docs/46 section B, docs/03 section 6): the fileserver's snapshot of what the admin backend
-- publishes. Public fields only; the tables have no provider, token, secret, title stream address or sources.
-- The titles tables are created here and filled by a later wave; the channels ones are filled by the channels sync.

-- One row per dataset ('channels' | 'titles'). synced_at NULL = never completed a sync (cold).
CREATE TABLE cache_state (
  dataset      TEXT PRIMARY KEY CHECK (dataset IN ('channels', 'titles')),
  source_key   TEXT NOT NULL,
  synced_at    INTEGER,
  attempted_at INTEGER,
  error_code   TEXT,
  revision     INTEGER,
  run          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE cached_channels (
  id         TEXT PRIMARY KEY,
  position   INTEGER NOT NULL,
  name       TEXT NOT NULL,
  number     TEXT,
  category   TEXT NOT NULL,
  logo_url   TEXT,
  stream_url TEXT NOT NULL,
  revision   INTEGER NOT NULL
);
CREATE INDEX cached_channels_position ON cached_channels (position);

-- in_catalog = 0 marks a title opened by a user action that the synced catalog does not list (never swept);
-- seen_run makes the sweep independent of the clock.
CREATE TABLE cached_titles (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  title       TEXT NOT NULL,
  year        INTEGER,
  rating      REAL,
  popularity  REAL,
  poster_url  TEXT,
  backdrop_url TEXT,
  plot        TEXT,
  cast_json   TEXT,
  runtime_ms  INTEGER,
  seasons_json TEXT,
  detail_at   INTEGER,
  in_catalog  INTEGER NOT NULL DEFAULT 1,
  seen_run    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX cached_titles_title ON cached_titles (title COLLATE NOCASE);
CREATE INDEX cached_titles_year ON cached_titles (year);
CREATE INDEX cached_titles_popularity ON cached_titles (popularity);

CREATE TABLE cached_title_genres (
  title_id TEXT NOT NULL REFERENCES cached_titles (id) ON DELETE CASCADE,
  genre    TEXT NOT NULL,
  PRIMARY KEY (title_id, genre)
) WITHOUT ROWID;
CREATE INDEX cached_title_genres_genre ON cached_title_genres (genre);

CREATE TABLE cached_genres (
  kind TEXT NOT NULL,
  id   TEXT NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (kind, id)
);
