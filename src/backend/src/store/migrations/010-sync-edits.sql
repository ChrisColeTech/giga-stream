-- 010-sync-edits: how the playlist sync treats what an admin changed (docs/26 section 3.10).
-- A synced channel records which fields an admin edited (`edited_fields`, a JSON array) and remembers the
-- playlist's own name (`sync_name`) apart from its display name, so a rename never breaks the match.

ALTER TABLE channels ADD COLUMN edited_fields TEXT;
ALTER TABLE channels ADD COLUMN sync_name TEXT;
UPDATE channels SET sync_name = name WHERE source IS NOT NULL;
