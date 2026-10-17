-- 012: the owner chose `Enabled` on the record instead of lists of deleted entries (docs/26 section 3.10, rule 4),
-- and playlists and jobs instead of stored sync settings (section 3.11). A database that already ran an earlier 010
-- or 011 loses the tables they made here; one that did not has nothing to drop. Deleting a synced row is now a real
-- delete.

DROP TABLE IF EXISTS sync_tombstones;
DROP TABLE IF EXISTS sync_settings;
