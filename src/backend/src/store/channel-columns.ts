/**
 * What a channel read selects: the stored columns, the sync-owned ones, and the three values derived from the parent
 * playlist by a `LEFT JOIN` (docs/43 section 3.1) - `source` (its host, or its file name), `playlist_name`, and
 * `published` (enabled, and the playlist enabled when there is one). They are read-only: nothing writes them.
 */
export const CHANNEL_SELECT = `
  c.id, c.name, c.category, c.number, c.logo_url, c.tvg_id, c.stream_url, c.revision, c.kind,
  c.live_mode, c.live_captions, c.live_variants, c.live_folder, c.edited_fields, c.sync_name, c.playlist_id, c.enabled,
  c.status, c.checked_at, c.logo_file, c.logo_checked_at,
  CASE WHEN p.kind = 'url' THEN p.host ELSE p.file_name END AS source,
  p.name AS playlist_name,
  CASE WHEN c.enabled = 1 AND (c.playlist_id IS NULL OR p.enabled = 1) THEN 1 ELSE 0 END AS published`;

export const CHANNEL_FROM = "channels c LEFT JOIN playlists p ON p.id = c.playlist_id";

/** The order of the whole list: numbered first by value, then by name (docs/03 section 7.2). */
export const CHANNEL_ORDER = "ORDER BY c.number IS NULL, CAST(c.number AS INTEGER), c.number, c.name COLLATE NOCASE, c.id";
