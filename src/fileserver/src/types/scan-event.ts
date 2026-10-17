import type { MediaFacts } from "../../../shared/media/dist/types/media-facts.js";
import type { ScanEvent } from "../../../shared/media/dist/types/scan.js";

export interface PublicScanFile {
  path: string;
  sizeBytes: number;
  modifiedMs: number;
  facts?: MediaFacts;
}

/** The scan's HTTP shape. The scanner's private `absolutePath` has no representable field here. */
export type PublicScanEvent =
  | { type: "found"; file: PublicScanFile }
  | { type: "probed"; file: PublicScanFile; facts: MediaFacts }
  | { type: "progress"; found: number; probed: number; total: number | null }
  | { type: "done"; found: number; probed: number; unplayable: number }
  | { type: "cancelled"; found: number; probed: number };

const publicFile = (file: Extract<ScanEvent, { type: "found" }>['file'] & { facts?: MediaFacts }): PublicScanFile => ({
  path: file.path,
  sizeBytes: file.sizeBytes,
  modifiedMs: file.modifiedMs,
  ...(file.facts !== undefined && { facts: file.facts }),
});

/** Maps internal scanner events before buffering or serialization, so catch-up is path-free too. */
export function publicScanEvent(event: ScanEvent): PublicScanEvent {
  if (event.type === "found") return { type: "found", file: publicFile(event.file) };
  if (event.type === "probed") return { type: "probed", file: publicFile(event.file), facts: event.facts };
  if (event.type === "done") {
    return { type: "done", found: event.found, probed: event.probed, unplayable: event.unplayable };
  }
  return event;
}
