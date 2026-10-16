import type { MediaFacts } from "./media-facts.ts";

/** A file a scan found. `path` is relative to the scanned folder, with `/`; `absolutePath` never leaves the server. */
export interface FoundFile {
  path: string;
  absolutePath: string;
  sizeBytes: number;
  modifiedMs: number;
}

export interface ScannedFile extends FoundFile {
  facts?: MediaFacts;
}

/** What a scan reports as it goes; the last event is always `done` or `cancelled`. */
export type ScanEvent =
  | { type: "found"; file: FoundFile }
  | { type: "probed"; file: FoundFile; facts: MediaFacts }
  | { type: "progress"; found: number; probed: number; total: number | null }
  | { type: "done"; files: ScannedFile[]; found: number; probed: number; unplayable: number }
  | { type: "cancelled"; found: number; probed: number };

export type ScanDone = Extract<ScanEvent, { type: "done" }>;

export interface ScanOptions {
  extensions?: readonly string[];
  /** Read each file's facts with ffprobe after finding them all (default true). */
  probe?: boolean;
  /** Files probed at once (default `SCAN_CONCURRENCY`). */
  concurrency?: number;
  signal?: AbortSignal;
}
