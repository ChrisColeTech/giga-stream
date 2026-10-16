/** The user's own data DTOs (docs/03 sections 3.7 and 3.8). No field here is a local path. */

/**
 * An item of the user's data, named by kind and id (03 section 2). A title's ride through the
 * fileserver unchanged; a local item is a keyed row in `local_files`.
 */
export type ItemRef = { kind: "title" | "local"; id: string };

/** An attached folder: what Library shows about it. `path` never appears anywhere (001 header). */
export interface Folder {
  id: string;
  collectionId: string;
  /** The folder's own name — the basename the picker chose — never its path. */
  name: string;
  /** Rows in `local_files` under it. */
  fileCount: number;
  /** A scan is queued or running for it (the scan registry answers this). */
  scanning: boolean;
  /** When its last scan settled, if one ever did. */
  lastScannedAt?: number;
}

/** A collection: manual members plus the files of its folders. */
export interface Collection {
  id: string;
  name: string;
  /** Manual members plus the file rows of its folders. */
  itemCount: number;
  folders: Folder[];
  /** Any of its folders is being scanned. */
  scanning: boolean;
  createdAt: number;
  updatedAt: number;
}
