-- The title store (docs/03 section 7.6b): a synced mirror of TMDB answers, not administered data.
CREATE TABLE titles (
  kind TEXT NOT NULL,                  -- 'movie' | 'tv'
  tmdb_id INTEGER NOT NULL,
  payload TEXT NOT NULL,               -- the stored title answer as JSON (image paths, never bytes)
  popularity_score REAL,
  popularity_read_at INTEGER,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (kind, tmdb_id)
);

CREATE TABLE title_lists (
  key TEXT PRIMARY KEY,                -- kind|sort|filters|page of one browse answer
  ids TEXT NOT NULL,                   -- the answer's title ids in order, as JSON
  total_pages INTEGER NOT NULL,
  total_results INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL
);

CREATE INDEX idx_titles_fetched ON titles (fetched_at);
CREATE INDEX idx_lists_fetched ON title_lists (fetched_at);
