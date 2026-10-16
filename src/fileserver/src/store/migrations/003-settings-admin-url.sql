-- 003-settings-admin-url (docs/03 section 6): the backend address becomes a setting, and the two
-- stored names change so nothing the user saved resets. admin_target may hold no row (a fresh
-- install): then adminUrl simply keeps its default.
INSERT INTO settings (key, value, updated_at)
  SELECT 'adminUrl', json_quote(base_url), updated_at FROM admin_target WHERE id = 1
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
DROP TABLE admin_target;

UPDATE settings SET key = 'libraryView' WHERE key = 'galleryView';
UPDATE settings SET value = '"green"' WHERE key = 'themeAccent' AND value = '"emerald"';
