/** What a collection holds, the owner's tag (`03` section 3.7): movies, TV, or local files. */
export type CollectionType = "movie" | "tv" | "local";

/** A folder choice returned by the desktop picker. The token is opaque and never rendered. */
export interface FolderSelection {
  readonly token: string;
  readonly name: string;
}

/** The validated collection shape shared by the request layer, store and collection window. */
export interface CollectionAnswer {
  readonly id: string;
  readonly name: string;
  readonly type: CollectionType;
  readonly itemCount: number;
  readonly folders: {
    readonly id: string;
    readonly collectionId: string;
    readonly name: string;
    readonly fileCount: number;
    readonly scanning: boolean;
    readonly lastScannedAt?: number;
  }[];
  readonly scanning: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

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

export interface ScanProgress {
  readonly found: number;
  readonly probed: number;
  readonly total: number | null;
  readonly done: boolean;
}

export type CreateCollectionResult =
  | { readonly outcome: "failed" }
  | { readonly outcome: "created" }
  | { readonly outcome: "attach-failed"; readonly collectionId: string };
