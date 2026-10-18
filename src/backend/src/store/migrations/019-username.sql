-- 019-username: the sign-in name is a plain username, not an email (owner, 2026-10-17: nothing is ever sent to an
-- email, so the login does not use one). The columns are renamed; every value stays as it is. The unique key keeps
-- comparing without case. No index or constraint names the old columns (the UNIQUE follows the column).

ALTER TABLE admin_accounts RENAME COLUMN email TO username;
ALTER TABLE admin_accounts RENAME COLUMN email_key TO username_key;
ALTER TABLE audit_log RENAME COLUMN actor_email TO actor_username;
ALTER TABLE reset_attempts RENAME COLUMN email_key TO username_key;

-- Old audit details name the sign-in name `email`; they are renamed so the Events drawer reads every row alike.
UPDATE audit_log
SET detail = json_set(json_remove(detail, '$.email'), '$.username', json_extract(detail, '$.email'))
WHERE detail IS NOT NULL AND json_valid(detail) AND json_type(detail, '$.email') = 'text';
