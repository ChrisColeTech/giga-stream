/** What a collection holds, the owner's tag (`03` section 3.7): movies, TV, or local files. */
export type CollectionType = "movie" | "tv" | "local";

/** One collection as the manager lists it: its type, its totals (every item), its manual members and the items its
 *  attached folders hold, and the aggregate scan state of those folders. */
export interface CollectionRow {
  readonly id: string;
  readonly name: string;
  readonly type: CollectionType;
  readonly total: number;
  readonly manual: number;
  readonly folders: number;
  readonly scan: "idle" | "scanning" | "failed";
}

/** A folder attached to a collection (`03` section 3.8): its location is never shown, only its name. */
export interface CollectionFolder {
  readonly id: string;
  readonly name: string;
  readonly indexedCount: number;
  readonly scan: "idle" | "scanning" | "failed";
  /** Unix milliseconds of the last finished scan, when there was one. */
  readonly lastScanAt?: number;
}
