-- 026-title-details (docs/47 sections 3.1 and 3.4): the Library fill's `details` phase keeps its bookkeeping here. A
-- title whose detail call failed records when and how many runs in a row (`detail_failed_at`, `detail_failures`: three
-- strikes and the phase skips it until its payload changes). The genre dictionary the public `GET /api/titles/genres`
-- serves is stored (TMDB's `/genre/{movie|tv}/list`, read once per Library fill run); a public read never calls TMDB.

ALTER TABLE titles ADD COLUMN detail_failed_at INTEGER;
ALTER TABLE titles ADD COLUMN detail_failures INTEGER;

CREATE TABLE title_genres (
  kind     TEXT    NOT NULL CHECK (kind IN ('movie', 'tv')),
  genre_id INTEGER NOT NULL,
  name     TEXT    NOT NULL,
  PRIMARY KEY (kind, genre_id)
);

CREATE INDEX idx_titles_popularity ON titles (popularity_score);
