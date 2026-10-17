-- 005-local-file-titles: repair blank legacy display titles from the private file basename.
-- Both Windows and POSIX separators are handled; only the basename is copied into title.
WITH RECURSIVE
blank_files(id, rest) AS (
  SELECT id, replace(trim(path), char(92), '/') || '/'
  FROM local_files
  WHERE trim(title) = ''
),
parts(id, part, rest) AS (
  SELECT id, '', rest FROM blank_files
  UNION ALL
  SELECT id, substr(rest, 1, instr(rest, '/') - 1), substr(rest, instr(rest, '/') + 1)
  FROM parts
  WHERE rest <> ''
),
basenames(id, title) AS (
  SELECT id, trim(part)
  FROM parts
  WHERE rest = '' AND trim(part) NOT IN ('', '.', '..')
)
UPDATE local_files
SET title = coalesce((SELECT title FROM basenames WHERE basenames.id = local_files.id), 'Local media')
WHERE trim(title) = '';
