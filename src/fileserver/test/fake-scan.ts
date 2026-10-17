import { readdirSync } from "node:fs";
import path from "node:path";

import type { FolderScanner } from "../src/services/scan-service.js";
import type { ScanEvent, ScannedFile, ScanOptions } from "../../shared/media/dist/types/scan.js";

export interface GatedScan {
  scan: FolderScanner;
  /** Lets every scan started with `scan` run to its end; until then each stays in flight. */
  release: () => void;
}

/**
 * A scanner that stays in flight until the test calls `release()`: no event is reported before then, so a
 * test can look at a queued or running scan. A promise is the gate (no timers); aborting ends it `cancelled`.
 */
export function gatedScan(): GatedScan {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  async function* scan(root: string, options: ScanOptions = {}): AsyncGenerator<ScanEvent> {
    const { signal } = options;
    await new Promise<void>((resolve) => {
      void gate.then(resolve);
      signal?.addEventListener("abort", () => resolve(), { once: true });
    });
    if (signal?.aborted) return yield { type: "cancelled", found: 0, probed: 0 };
    yield* fakeScan(root, options);
  }
  return { scan, release };
}

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
