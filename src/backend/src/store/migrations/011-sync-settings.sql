-- 011-sync-settings: the sync schedules and the playlist addresses an admin edits (docs/26 section 3.11).
-- Keys: title_schedule, playlist_schedule (text such as '6h', or 'off'), playlist_urls (a JSON array of
-- { id, url }) and playlist_next_id. The environment (TMDB_SYNC_SCHEDULE, PLAYLIST_SYNC_SCHEDULE, PLAYLIST_URLS)
-- seeds a key on the first start only; after that the stored value wins. A playlist address can carry
-- credentials in its query, so it is stored here and never returned or audited beyond its host.

CREATE TABLE sync_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
