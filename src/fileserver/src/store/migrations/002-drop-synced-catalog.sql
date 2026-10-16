-- 002-drop-synced-catalog (docs/14 section 5a, docs/02 section 7.1): the fileserver keeps no copy of
-- the admin backend's data. Children are dropped before their parents (foreign keys are on):
-- relay_sessions -> playback_sessions, provider_health -> provider_definitions, episodes -> titles.
-- Kept untouched: settings, shell_state, admin_target, channel_state, collections, collection_items,
-- collection_folders, local_files, favorites, watch_entries and jobs. None of them references a
-- dropped table (item_id columns hold plain typed ids, not foreign keys).
DROP TABLE IF EXISTS relay_sessions;
DROP TABLE IF EXISTS playback_sessions;
DROP TABLE IF EXISTS provider_health;
DROP TABLE IF EXISTS provider_definitions;
DROP TABLE IF EXISTS episodes;
DROP TABLE IF EXISTS titles;
DROP TABLE IF EXISTS channels;
DROP TABLE IF EXISTS admin_sync;

-- The two removed job kinds can no longer be read back; settled rows of them are history of nothing.
DELETE FROM jobs WHERE kind IN ('catalog-sync', 'provider-check');
