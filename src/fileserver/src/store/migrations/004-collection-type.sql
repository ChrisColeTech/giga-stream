-- 004-collection-type: collections now carry the owner's movie, TV or local tag (03 section 3.7).
-- Existing folders are conclusive local evidence. A uniform modern title-id prefix is stronger evidence
-- for old folder-free collections; ambiguous and legacy title ids migrate safely to local.
ALTER TABLE collections ADD COLUMN type TEXT NOT NULL DEFAULT 'local'
  CHECK (type IN ('movie', 'tv', 'local'));

UPDATE collections SET type = 'movie'
WHERE NOT EXISTS (SELECT 1 FROM collection_folders f WHERE f.collection_id = collections.id)
  AND EXISTS (
    SELECT 1 FROM collection_items i
    WHERE i.collection_id = collections.id AND i.item_kind = 'title' AND i.item_id LIKE 'movie-%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM collection_items i
    WHERE i.collection_id = collections.id AND (i.item_kind <> 'title' OR i.item_id NOT LIKE 'movie-%')
  );

UPDATE collections SET type = 'tv'
WHERE NOT EXISTS (SELECT 1 FROM collection_folders f WHERE f.collection_id = collections.id)
  AND EXISTS (
    SELECT 1 FROM collection_items i
    WHERE i.collection_id = collections.id AND i.item_kind = 'title' AND i.item_id LIKE 'tv-%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM collection_items i
    WHERE i.collection_id = collections.id AND (i.item_kind <> 'title' OR i.item_id NOT LIKE 'tv-%')
  );
