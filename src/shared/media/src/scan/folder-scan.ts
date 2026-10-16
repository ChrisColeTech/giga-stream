import { stat } from "node:fs/promises";
import path from "node:path";

import { SCAN_CONCURRENCY, UNREADABLE_SENTENCE, VIDEO_EXTENSIONS } from "../constants/media.ts";
import { probeFile } from "../probe/probe-file.ts";
import type { MediaFacts } from "../types/media-facts.ts";
import type { ScanDone, ScanEvent, ScannedFile, ScanOptions } from "../types/scan.ts";
import { walkFolder } from "./walk-folder.ts";

/**
 * Scans a folder for video files and reports as it goes (docs/03 section 3.8): a `found` and a `progress` for
 * each file as the walk finds it, then a `probed` and a `progress` for each file whose facts the bundled
 * ffprobe reads, then `done` with every file. Aborting the signal stops it at the next step with `cancelled`.
 * Files are only ever read. A folder that does not exist rejects before the first event.
 */
export async function* scanFolder(root: string, options: ScanOptions = {}): AsyncGenerator<ScanEvent> {
  const { probe = true, concurrency = SCAN_CONCURRENCY, signal } = options;
  const extensions = new Set((options.extensions ?? VIDEO_EXTENSIONS).map((e) => e.toLowerCase()));
  const resolved = path.resolve(root);
  if (!(await stat(resolved)).isDirectory()) throw new Error(`not a folder: ${resolved}`);

  const files: ScannedFile[] = [];
  for await (const file of walkFolder(resolved, resolved, extensions, signal)) {
    files.push(file);
    yield { type: "found", file };
    yield { type: "progress", found: files.length, probed: 0, total: null };
  }
  if (signal?.aborted) return yield { type: "cancelled", found: files.length, probed: 0 };

  let probed = 0;
  if (probe) {
    for (let start = 0; start < files.length; start += concurrency) {
      if (signal?.aborted) return yield { type: "cancelled", found: files.length, probed };
      const batch = files.slice(start, start + concurrency);
      const read = await Promise.allSettled(batch.map((file) => probeFile(file.absolutePath, signal)));
      if (signal?.aborted) return yield { type: "cancelled", found: files.length, probed };
      for (const [index, file] of batch.entries()) {
        const outcome = read[index];
        const facts: MediaFacts =
          outcome?.status === "fulfilled" ? outcome.value : { playable: false, problem: UNREADABLE_SENTENCE };
        file.facts = facts;
        probed += 1;
        yield { type: "probed", file, facts };
        yield { type: "progress", found: files.length, probed, total: files.length };
      }
    }
  }
  const unplayable = files.filter((file) => file.facts && !file.facts.playable).length;
  yield { type: "done", files, found: files.length, probed, unplayable };
}

/** Runs a scan to the end and answers its `done` event; for callers that do not show progress. */
export async function scanFolderToEnd(root: string, options: ScanOptions = {}): Promise<ScanDone> {
  for await (const event of scanFolder(root, options)) {
    if (event.type === "done") return event;
    if (event.type === "cancelled") throw new Error("the scan was cancelled");
  }
  throw new Error("the scan ended without a result");
}
