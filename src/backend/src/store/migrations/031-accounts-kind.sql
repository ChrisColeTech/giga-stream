-- 031-accounts-kind: the account row gains its `kind` (docs/62 decision D1) and the app's four per-account
-- tables (docs/62 section 3.1). Existing rows are admins by default; hashes, refresh tokens, session versions,
-- lockout counters and the audit log are reused untouched. SQLite checks the new CHECK for new rows only,
-- which is enough: the DEFAULT fills every existing row with 'admin'.

ALTER TABLE admin_accounts ADD COLUMN kind TEXT NOT NULL DEFAULT 'admin' CHECK (kind IN ('admin', 'user'));

-- The signed-in account's settings document: the whole JSON the app PUTs, replaced on every write.
CREATE TABLE user_settings (
  account_id TEXT PRIMARY KEY REFERENCES admin_accounts (id) ON DELETE CASCADE,
  settings   TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Favorites are a flat additive set per account; the ref names the item the way the fileserver's do.
CREATE TABLE user_favorites (
  account_id TEXT NOT NULL REFERENCES admin_accounts (id) ON DELETE CASCADE,
  ref_kind   TEXT NOT NULL,
  ref_id     TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, ref_kind, ref_id)
);

-- Collections with their manual members (docs/62 section 3.1): the fileserver's shapes, per account. The
-- backend has no folders and no scans, so a collection is its row and its items.
CREATE TABLE user_collections (
  id         TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES admin_accounts (id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE user_collection_items (
  collection_id TEXT NOT NULL REFERENCES user_collections (id) ON DELETE CASCADE,
  ref_kind      TEXT NOT NULL,
  ref_id        TEXT NOT NULL,
  added_at      INTEGER NOT NULL,
  PRIMARY KEY (collection_id, ref_kind, ref_id)
);

CREATE INDEX idx_user_collections_account ON user_collections (account_id);
