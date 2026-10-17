-- 016-providers-no-api-key: providers do not use API keys (docs/26 decision D24), so `api_key` goes. Rebuilt for
-- certainty rather than relying on DROP COLUMN: new table, rows copied with their ids, old table dropped, new one
-- renamed. Every other column (003 and 006) is kept as it was.

CREATE TABLE providers_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  family TEXT NOT NULL DEFAULT 'embed',
  movie_template TEXT NULL,
  episode_template TEXT NULL,
  start_param TEXT NULL,
  subtitles_param TEXT NULL,
  origin TEXT NULL,
  frame_origins TEXT NULL,
  message_shape TEXT NULL
);

INSERT INTO providers_new (id, name, source, is_active, created_at, "order", family, movie_template,
  episode_template, start_param, subtitles_param, origin, frame_origins, message_shape)
SELECT id, name, source, is_active, created_at, "order", family, movie_template,
  episode_template, start_param, subtitles_param, origin, frame_origins, message_shape
FROM providers;

-- Ids are never reused: the new table inherits the old one's counter.
UPDATE sqlite_sequence
SET seq = MAX(seq, (SELECT COALESCE(MAX(seq), 0) FROM sqlite_sequence WHERE name = 'providers'))
WHERE name = 'providers_new';

DROP TABLE providers;
ALTER TABLE providers_new RENAME TO providers;
