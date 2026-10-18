-- 018-security-questions: the password reset by security question (docs/40 section 3.1). Each account may hold one
-- question (a picklist number, 1 to 8) and a scrypt hash of its normalised answer; existing accounts get none (NULL).
-- The reset attempts are counted per normalised email, known or unknown, so an unknown email locks the same way.

ALTER TABLE admin_accounts ADD COLUMN security_question INTEGER CHECK (security_question BETWEEN 1 AND 8);
ALTER TABLE admin_accounts ADD COLUMN security_answer_hash TEXT;

CREATE TABLE reset_attempts (
  email_key    TEXT PRIMARY KEY,
  failed       INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER
);
