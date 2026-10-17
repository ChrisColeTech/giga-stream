-- 004-collection-type: collections now carry the owner's movie, TV or local tag (03 section 3.7).
-- Existing folders are conclusive local evidence. Uniform lowercase movie-<digits> or tv-<digits>
-- memberships are stronger evidence for folder-free collections; every ambiguous form stays local.
ALTER TABLE collections ADD COLUMN type TEXT NOT NULL DEFAULT 'local'
  CHECK (type IN ('movie', 'tv', 'local'));

UPDATE collections SET type = 'movie'
WHERE NOT EXISTS (SELECT 1 FROM collection_folders f WHERE f.collection_id = collections.id)
  AND EXISTS (
    SELECT 1 FROM collection_items i
    WHERE i.collection_id = collections.id AND i.item_kind = 'title'
      AND i.item_id GLOB 'movie-[0-9]*' AND substr(i.item_id, 7) NOT GLOB '*[^0-9]*'
  )
  AND NOT EXISTS (
    SELECT 1 FROM collection_items i
    WHERE i.collection_id = collections.id AND (
      i.item_kind <> 'title' OR i.item_id NOT GLOB 'movie-[0-9]*'
      OR substr(i.item_id, 7) GLOB '*[^0-9]*'
    )
  );

UPDATE collections SET type = 'tv'
WHERE NOT EXISTS (SELECT 1 FROM collection_folders f WHERE f.collection_id = collections.id)
  AND EXISTS (
    SELECT 1 FROM collection_items i
    WHERE i.collection_id = collections.id AND i.item_kind = 'title'
      AND i.item_id GLOB 'tv-[0-9]*' AND substr(i.item_id, 4) NOT GLOB '*[^0-9]*'
  )
  AND NOT EXISTS (
    SELECT 1 FROM collection_items i
    WHERE i.collection_id = collections.id AND (
      i.item_kind <> 'title' OR i.item_id NOT GLOB 'tv-[0-9]*'
      OR substr(i.item_id, 4) GLOB '*[^0-9]*'
    )
  );
