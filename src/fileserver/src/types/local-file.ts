/** The local-media info answer (docs/03 section 3.10) for the Player's details. */

export interface LocalFileInfo {
  id: string;
  /** The file's display name, for example "Concert.mkv". */
  title: string;
  /** The probe's facts; absent when the file is not playable or was not probed. */
  durationMs?: number;
  sizeBytes?: number;
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
  container?: string;
  /** Whether ffprobe could read the file at all. */
  playable: boolean;
  /** Why it is unplayable; never a path. */
  error?: { code: string; message: string };
  /** The collections it is in, manually or through its folder. */
  collectionIds: string[];
  /** The name of the folder it was found in. */
  folderName: string;
}

/** The range answer's headers (with `Content-Range`, `206`) — never a path to the byte layer. */
export interface MediaPlan {
  status: 200 | 206;
  headers: Record<string, string>;
  fullPath: string;
  start: number;
  /** Byte offset true to size-1; a full answer runs 0..size-1. */
  end: number;
}
