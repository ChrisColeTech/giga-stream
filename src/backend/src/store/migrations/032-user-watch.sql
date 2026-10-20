-- 032-user-watch: the signed-in account's watch history (docs/63 section 3.2) - the cloud rows a browser's
-- watch write lands in when the fileserver passes it through. The fileserver's watch_entries shapes, per
-- account: the identity is the item with its exact episode, unique per account (docs/63's COALESCE index;
-- an absent season or episode keys as 0, and writes carry only positive episode numbers, so the sentinel
-- never meets a real one). playback_id and seq are the write's own ordering marks, kept with the row.

CREATE TABLE user_watch (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES admin_accounts (id) ON DELETE CASCADE,
  item_kind   TEXT NOT NULL CHECK (item_kind IN ('title', 'local')),
  item_id     TEXT NOT NULL,
  season      INTEGER,
  episode     INTEGER,
  position_ms INTEGER NOT NULL,
  duration_ms INTEGER,
  state       TEXT NOT NULL CHECK (state IN ('watching', 'watched')),
  updated_at  INTEGER NOT NULL,
  playback_id TEXT NOT NULL,
  seq         INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_user_watch_identity
  ON user_watch (account_id, item_kind, item_id, COALESCE(season, 0), COALESCE(episode, 0));

-- The list answers the account's entries newest first, every query account-scoped, so the index leads
-- with the account.
CREATE INDEX idx_user_watch_updated ON user_watch (account_id, updated_at DESC);
