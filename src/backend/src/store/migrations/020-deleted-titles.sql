-- 020-deleted-titles: a deleted synced (TMDB) title stays deleted (docs/26 decision D20, docs/03 section 7.4). The
-- stored copy is removed and its TMDB identity is kept here, so the browse, search, detail and the catalog sync skip
-- it; restoring removes the row. `title` is the last known title text, kept only to name the row in the restore list.
-- A title made by hand is deleted for real and never recorded.

CREATE TABLE deleted_titles (
  kind       TEXT    NOT NULL CHECK (kind IN ('movie', 'tv')),
  tmdb_id    INTEGER NOT NULL,
  title      TEXT,
  deleted_at INTEGER NOT NULL,
  PRIMARY KEY (kind, tmdb_id)
);
