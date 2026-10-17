-- 017-admin-ui-state: the admin's settings and shell layout, one row per admin account (docs/26 decision D16,
-- docs/29 section 12.2). Both documents are JSON text, each written whole; the row goes with its account.

CREATE TABLE admin_ui_state (
  account_id TEXT PRIMARY KEY REFERENCES admin_accounts (id) ON DELETE CASCADE,
  settings   TEXT NOT NULL,
  shell      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
