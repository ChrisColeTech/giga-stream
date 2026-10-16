import { opendir, stat } from "node:fs/promises";
import path from "node:path";

import type { FoundFile } from "../types/scan.ts";

/**
 * Every file under `dir` whose extension is in `extensions`, depth first and sorted by name, skipping
 * dot-folders and anything that is not a plain file or folder (links are not followed). `root` is the scanned
 * folder the relative paths are measured from.
 */
export async function* walkFolder(
  root: string,
  dir: string,
  extensions: ReadonlySet<string>,
  signal?: AbortSignal,
): AsyncGenerator<FoundFile> {
  const entries = [];
  for await (const entry of await opendir(dir)) entries.push(entry);
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (signal?.aborted) return;
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      yield* walkFolder(root, absolutePath, extensions, signal);
    } else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
      const info = await stat(absolutePath);
      const relative = path.relative(root, absolutePath).split(path.sep).join("/");
      yield { path: relative, absolutePath, sizeBytes: info.size, modifiedMs: Math.round(info.mtimeMs) };
    }
  }
}
