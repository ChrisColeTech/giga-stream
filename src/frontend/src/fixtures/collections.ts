import type { CollectionFolder, CollectionRow } from "@/types/collection";
import type { ItemRef } from "@/types/library";

/** PHASE 1 FIXTURE: the collections the Library rail and the Collections window draw (`03` section 3.7). */
export const COLLECTION_ROWS: readonly CollectionRow[] = [
  { id: "c-weekend", name: "Weekend picks", type: "movie", total: 4, manual: 4, folders: 0, scan: "idle" },
  { id: "c-local", name: "Local films", type: "local", total: 6, manual: 2, folders: 1, scan: "scanning" },
  { id: "c-kids", name: "Kids", type: "tv", total: 0, manual: 0, folders: 0, scan: "idle" },
];

/** PHASE 1 FIXTURE: each collection's manual members, as item references. */
export const COLLECTION_MEMBERS: Readonly<Record<string, readonly ItemRef[]>> = {
  "c-weekend": [
    { kind: "title", id: "movie-603" },
    { kind: "title", id: "movie-27205" },
    { kind: "title", id: "tv-95396" },
    { kind: "title", id: "movie-335984" },
  ],
  "c-local": [
    { kind: "local", id: "local-1" },
    { kind: "local", id: "local-2" },
  ],
  "c-kids": [],
};

/** PHASE 1 FIXTURE: the folders attached to each collection (`03` section 3.8). The location is never shown. */
export const COLLECTION_FOLDERS: Readonly<Record<string, readonly CollectionFolder[]>> = {
  "c-weekend": [],
  "c-local": [{ id: "f-films", name: "Films", indexedCount: 6, scan: "scanning", lastScanAt: 1790000000000 }],
  "c-kids": [],
};

/** PHASE 1 FIXTURE: which collections each title is in, keyed by item id; the Collections submenu's check marks. */
export const MEMBERSHIP: Readonly<Record<string, readonly string[]>> = {
  "movie-603": ["c-weekend"],
  "movie-27205": ["c-weekend"],
  "tv-95396": ["c-weekend"],
  "movie-335984": ["c-weekend"],
  "local-1": ["c-local"],
  "local-2": ["c-local"],
};
