/** What ffprobe says about a file (docs/03 section 3.8): enough to list, describe and play it. */
export interface MediaFacts {
  playable: boolean;
  /** Why the file cannot be played, in one sentence; only when `playable` is false. */
  problem?: string;
  container?: string;
  durationMs?: number;
  width?: number;
  height?: number;
  frameRate?: number;
  videoCodec?: string;
  audioCodec?: string;
  audioChannels?: number;
}
