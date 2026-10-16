-- 002-accounts: admin accounts, their refresh tokens and the audit log (docs/03 sections 7.11-7.13).

CREATE TABLE admin_accounts (
  id               TEXT PRIMARY KEY,
  email            TEXT NOT NULL,
  email_key        TEXT NOT NULL UNIQUE,          -- the email lower-cased: emails compare without case
  name             TEXT NOT NULL,
  role             TEXT NOT NULL CHECK (role IN ('owner', 'editor')),
  password_hash    TEXT NOT NULL,                 -- scrypt$N$r$p$salt$hash, never the password
  disabled         INTEGER NOT NULL DEFAULT 0,
  session_version  INTEGER NOT NULL DEFAULT 1,    -- the `ver` claim; raised to revoke every session
  failed_sign_ins  INTEGER NOT NULL DEFAULT 0,
  locked_until     INTEGER,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  last_sign_in_at  INTEGER
);

-- Only the SHA-256 of a refresh token is kept. A token is used once; a used one presented again means
-- it was copied, and every session of its account is revoked.
CREATE TABLE refresh_tokens (
  id          TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES admin_accounts (id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER,
  revoked_at  INTEGER
);
CREATE INDEX idx_refresh_tokens_account ON refresh_tokens (account_id);

-- Who did what. Never a password, token or hash.
CREATE TABLE audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  at           INTEGER NOT NULL,
  actor_id     TEXT,
  actor_email  TEXT,
  action       TEXT NOT NULL,
  subject      TEXT,
  detail       TEXT,
  address      TEXT
);
