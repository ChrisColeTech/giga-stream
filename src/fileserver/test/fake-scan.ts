import { readdirSync } from "node:fs";
import path from "node:path";

import type { ScanEvent, ScannedFile, ScanOptions } from "../../shared/media/dist/types/scan.js";

/**
 * A scanner standing in for the shared one: every file in the folder is reported as found, then as probed
 * unplayable, with no ffprobe process, so a test depends on neither the tools nor real process time.
 * A folder that does not exist rejects on the first step, as the real scanner does.
 */
export async function* fakeScan(root: string, options: ScanOptions = {}): AsyncGenerator<ScanEvent> {
  const files: ScannedFile[] = readdirSync(root).map((name) => ({
    path: name,
    absolutePath: path.join(root, name),
    sizeBytes: 5,
    modifiedMs: 1,
  }));
  for (const [index, file] of files.entries()) {
    yield { type: "found", file };
    yield { type: "progress", found: index + 1, probed: 0, total: null };
  }
  if (options.signal?.aborted) return yield { type: "cancelled", found: files.length, probed: 0 };
  for (const [index, file] of files.entries()) {
    const facts = { playable: false, problem: "The file could not be read as video." };
    file.facts = facts;
    yield { type: "probed", file, facts };
    yield { type: "progress", found: files.length, probed: index + 1, total: files.length };
  }
  yield { type: "done", files, found: files.length, probed: files.length, unplayable: files.length };
}
