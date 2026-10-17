-- 010-sync-edits: how the syncs treat what an admin changed (docs/26 section 3.10).
-- A synced channel records which fields an admin edited (`edited_fields`, a JSON array) and remembers the
-- playlist's own name (`sync_name`) apart from its display name, so a rename never breaks the match.
-- `sync_tombstones` remembers what an admin deleted from a sync, so the next sync does not bring it back:
-- a channel by playlist host and tvg-id or sync name, a title by kind and TMDB id.

ALTER TABLE channels ADD COLUMN edited_fields TEXT;
ALTER TABLE channels ADD COLUMN sync_name TEXT;
UPDATE channels SET sync_name = name WHERE source IS NOT NULL;

CREATE TABLE sync_tombstones (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL CHECK (kind IN ('channel', 'movie', 'tv')),
  host       TEXT,
  tvg_id     TEXT,
  sync_name  TEXT,
  tmdb_id    INTEGER,
  label      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (
    (kind = 'channel' AND host IS NOT NULL AND (tvg_id IS NOT NULL OR sync_name IS NOT NULL))
    OR (kind IN ('movie', 'tv') AND tmdb_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX sync_tombstones_title ON sync_tombstones (kind, tmdb_id) WHERE tmdb_id IS NOT NULL;
