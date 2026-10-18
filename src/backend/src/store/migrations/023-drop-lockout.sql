-- 023-drop-lockout: sign-in is not rate limited or locked out (owner, 2026-10-18: a single-owner tool), so the lockout
-- counters and the reset attempt table go. The two account columns carry no index, key or CHECK, so SQLite drops them in
-- place and every other column and row is untouched; reset_attempts is keyed by its own primary key only and nothing
-- references it.

ALTER TABLE admin_accounts DROP COLUMN failed_sign_ins;
ALTER TABLE admin_accounts DROP COLUMN locked_until;
DROP TABLE reset_attempts;
