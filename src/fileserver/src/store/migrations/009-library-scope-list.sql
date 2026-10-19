-- 009-library-scope-list (docs/58 decision 6): saved scalar media choices become canonical lists.
-- migrate-if-table-exists: settings
-- Updating only value preserves unrelated settings and every row's updated_at.
UPDATE settings
SET value = CASE value
  WHEN '"all"' THEN '["movie","tv","local"]'
  WHEN '"movie"' THEN '["movie"]'
  WHEN '"tv"' THEN '["tv"]'
  WHEN '"local"' THEN '["local"]'
END
WHERE key = 'libraryScope' AND value IN ('"all"', '"movie"', '"tv"', '"local"');
