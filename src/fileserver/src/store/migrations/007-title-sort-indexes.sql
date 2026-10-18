-- 007-title-sort-indexes (docs/46 section B): one covering index per cached-title sort, so a page (a deep offset
-- included) walks an index in order instead of sorting every matching row. Each index lists the sort's own ORDER BY
-- terms (cached-title-query.ts) ending in the id, so the id is read from the index without touching the table.
-- Additive and safe on an existing cache: indexes only, no data change; the single-column title index is a prefix
-- of cached_titles_az and is replaced by it. cached_titles_year and cached_titles_popularity stay (year filter,
-- popularity probe).

DROP INDEX IF EXISTS cached_titles_title;

CREATE INDEX IF NOT EXISTS cached_titles_az ON cached_titles (title COLLATE NOCASE, id);

CREATE INDEX IF NOT EXISTS cached_titles_newest ON cached_titles (
  (year IS NULL), year DESC, (popularity IS NULL), popularity DESC, title COLLATE NOCASE, id
);

CREATE INDEX IF NOT EXISTS cached_titles_oldest ON cached_titles (
  (year IS NULL), year ASC, (popularity IS NULL), popularity DESC, title COLLATE NOCASE, id
);

CREATE INDEX IF NOT EXISTS cached_titles_year_sort ON cached_titles (
  (year IS NULL), year DESC, title COLLATE NOCASE, id
);

CREATE INDEX IF NOT EXISTS cached_titles_trending ON cached_titles (
  (popularity IS NULL), popularity DESC, title COLLATE NOCASE, id
);
