-- 024-first-full-pass: the logo cache and the stream check exist from this version on (docs/43 section 6). A playlist's
-- job that has never run is due at the first start, so clearing its last run makes the first full pass (logos, then
-- every stream's verdict) happen at the first start after this ships. Nothing else changes.

UPDATE sync_jobs SET last_run_at = NULL WHERE type = 'playlist';
