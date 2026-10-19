-- 008-settings-theme-motion (docs/57 decision 8): remove the retired system choices before settings are read.
-- migrate-if-table-exists: settings
-- Updating only value preserves each setting's key and updated_at.
UPDATE settings SET value = '"dark"' WHERE key = 'theme' AND value = '"system"';
UPDATE settings SET value = '"off"' WHERE key = 'reducedMotion' AND value = '"system"';
