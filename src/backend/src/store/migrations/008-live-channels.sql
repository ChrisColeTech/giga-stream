-- 008-live-channels: the live server's channels join the admin backend's (docs/26 sections 3.2 and 3.3).
-- `kind` says what a row is: 'stream' (an address the fileserver hands to a player; every row so far) or
-- 'live' (a playlist of real videos this backend encodes and serves as live HLS, docs/10). A live row stores
-- no stream address (it is built from the caller's origin at read time) and carries its own columns:
-- `live_mode`, `live_captions`, `live_variants` (a JSON array) and, for a folder source, `live_folder`; a list
-- source is the ordered rows of `channel_videos`. SQLite cannot drop NOT NULL from `stream_url`, so the table
-- is rebuilt. Nothing else references `channels`, so the swap is safe with foreign keys on.

CREATE TABLE channels_next (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  number        TEXT,
  logo_url      TEXT,
  stream_url    TEXT,
  revision      INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,
  tvg_id        TEXT,
  source        TEXT,
  kind          TEXT NOT NULL DEFAULT 'stream' CHECK (kind IN ('stream', 'live')),
  live_mode     TEXT CHECK (live_mode IN ('loop', 'encode')),
  live_captions INTEGER CHECK (live_captions IN (0, 1)),
  live_variants TEXT,
  live_folder   TEXT,
  CHECK (
    (kind = 'stream' AND stream_url IS NOT NULL AND live_mode IS NULL)
    OR (kind = 'live' AND stream_url IS NULL AND live_mode IS NOT NULL
        AND live_captions IS NOT NULL AND live_variants IS NOT NULL)
  )
);

INSERT INTO channels_next (id, name, category, number, logo_url, stream_url, revision, created_at, tvg_id, source)
SELECT id, name, category, number, logo_url, stream_url, revision, created_at, tvg_id, source FROM channels;

DROP TABLE channels;
ALTER TABLE channels_next RENAME TO channels;

-- A live number is unique among live rows (`channel.taken`); stream rows keep free, repeatable text.
CREATE UNIQUE INDEX channels_live_number ON channels (number) WHERE kind = 'live';

-- A list source: the videos in play order, deleted with the channel.
CREATE TABLE channel_videos (
  channel_id TEXT NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  path       TEXT NOT NULL,
  PRIMARY KEY (channel_id, position)
);
