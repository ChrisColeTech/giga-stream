-- 013-enabled: `Enabled` is a field on the record (docs/26 section 3.11). A disabled channel or title stays in the
-- admin's lists and is left out of every public read; no sync changes it. Every existing row is enabled.

ALTER TABLE channels ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1));
ALTER TABLE titles ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1));
