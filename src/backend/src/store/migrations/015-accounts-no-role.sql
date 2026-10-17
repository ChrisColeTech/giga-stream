-- 015-accounts-no-role: every admin account is equal (docs/26 decision D22), so `role` goes. SQLite cannot drop a
-- column that carries a CHECK, so the table is rebuilt: new table, rows copied (ids, hashes, counters and
-- timestamps unchanged), old table dropped, new one renamed. Dropping the old table cascades to refresh_tokens
-- while foreign keys are on, so those rows are parked in a copy and put back.

CREATE TABLE refresh_tokens_keep AS SELECT * FROM refresh_tokens;

CREATE TABLE admin_accounts_new (
  id               TEXT PRIMARY KEY,
  email            TEXT NOT NULL,
  email_key        TEXT NOT NULL UNIQUE,          -- the email lower-cased: emails compare without case
  name             TEXT NOT NULL,
  password_hash    TEXT NOT NULL,                 -- scrypt$N$r$p$salt$hash, never the password
  disabled         INTEGER NOT NULL DEFAULT 0,
  session_version  INTEGER NOT NULL DEFAULT 1,    -- the `ver` claim; raised to revoke every session
  failed_sign_ins  INTEGER NOT NULL DEFAULT 0,
  locked_until     INTEGER,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  last_sign_in_at  INTEGER
);

INSERT INTO admin_accounts_new (id, email, email_key, name, password_hash, disabled, session_version,
  failed_sign_ins, locked_until, created_at, updated_at, last_sign_in_at)
SELECT id, email, email_key, name, password_hash, disabled, session_version,
  failed_sign_ins, locked_until, created_at, updated_at, last_sign_in_at
FROM admin_accounts;

DROP TABLE admin_accounts;
ALTER TABLE admin_accounts_new RENAME TO admin_accounts;

INSERT OR IGNORE INTO refresh_tokens (id, account_id, token_hash, created_at, expires_at, used_at, revoked_at)
SELECT id, account_id, token_hash, created_at, expires_at, used_at, revoked_at FROM refresh_tokens_keep;
DROP TABLE refresh_tokens_keep;
