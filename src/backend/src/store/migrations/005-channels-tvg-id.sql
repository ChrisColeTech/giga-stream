-- 005-channels-tvg-id: the playlist sync's own keys (docs/03 section 7.2c). `tvg_id` is the playlist's
-- tvg-id, the sync's update key; `source` is the playlist URL's host and marks a row the sync owns —
-- a hand-created row has neither, and the sync never updates or removes it.

ALTER TABLE channels ADD COLUMN tvg_id TEXT;
ALTER TABLE channels ADD COLUMN source TEXT;
