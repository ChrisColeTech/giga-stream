-- 009-title-records: titles become records an admin can create, edit and delete (docs/26 decision D20 and 3.10).
-- A row now has its own `id` ('movie-603', 'tv-1399' or, for a title made by hand, 'custom-<uuid>'), an `origin`
-- ('tmdb' mirrors TMDB, 'manual' is the admin's own) and `edited_fields`, a JSON array of the payload fields an
-- admin changed on a synced row: a sync merges TMDB's payload under them and never overwrites them. A manual
-- title's `tmdb_id` is optional (with one the providers can fill sources for it). The primary key moves from
-- (kind, tmdb_id) to `id`, so the table is rebuilt; every existing row keeps its payload and freshness.

CREATE TABLE titles_next (
  id                 TEXT PRIMARY KEY,
  kind               TEXT NOT NULL,                 -- 'movie' | 'tv'
  tmdb_id            INTEGER,
  payload            TEXT NOT NULL,
  popularity_score   REAL,
  popularity_read_at INTEGER,
  fetched_at         INTEGER NOT NULL,
  origin             TEXT NOT NULL DEFAULT 'tmdb' CHECK (origin IN ('tmdb', 'manual')),
  edited_fields      TEXT,
  CHECK (origin = 'manual' OR tmdb_id IS NOT NULL)
);

INSERT INTO titles_next (id, kind, tmdb_id, payload, popularity_score, popularity_read_at, fetched_at)
SELECT kind || '-' || tmdb_id, kind, tmdb_id, payload, popularity_score, popularity_read_at, fetched_at FROM titles;

DROP TABLE titles;
ALTER TABLE titles_next RENAME TO titles;

-- A TMDB title is unique by kind and TMDB id; manual titles may share a TMDB id with one.
CREATE UNIQUE INDEX titles_tmdb ON titles (kind, tmdb_id) WHERE origin = 'tmdb';
CREATE INDEX idx_titles_fetched ON titles (fetched_at);
CREATE INDEX idx_titles_origin ON titles (origin);
