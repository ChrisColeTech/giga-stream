-- 001-init: the channels (docs/10 section 3.1) and the videos a channel lists, in play order. A channel
-- plays every video in its folder or the videos listed for it; exactly one of the two.

CREATE TABLE channels (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL,
  number     INTEGER NOT NULL UNIQUE,
  mode       TEXT NOT NULL CHECK (mode IN ('loop', 'encode')),
  captions   INTEGER NOT NULL CHECK (captions IN (0, 1)),
  variants   TEXT NOT NULL,
  folder     TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE channel_videos (
  channel_id TEXT NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  path       TEXT NOT NULL,
  PRIMARY KEY (channel_id, position)
);
