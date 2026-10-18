-- 021-accounts-no-name: an account is its username; the display name was never used (owner, 2026-10-17). The column
-- carries no index, key or CHECK, so SQLite drops it in place: every other column and row is untouched.

ALTER TABLE admin_accounts DROP COLUMN name;
