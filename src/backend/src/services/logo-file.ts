import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/** Codes a Windows rename answers when the destination is open or being replaced by another writer (or a scanner). */
const BUSY = new Set(["EEXIST", "EPERM", "EBUSY", "EACCES"]);
const RENAME_TRIES = 5;
const RENAME_WAIT_MS = 20;

const codeOf = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : undefined;

/**
 * Writes a content-named cache file once (docs/43 section 3.1: an identical image is stored once, an existing file is
 * never rewritten). Safe against concurrent writers of the same bytes: every write has its own temp name, a file that
 * already exists is success, a rename refused because another writer holds or has just created the destination is
 * success, and the temp file is removed on every path. It throws only when the file could not be put in place at all.
 */
export async function writeCacheFile(dir: string, name: string, bytes: Buffer): Promise<void> {
  const target = path.join(dir, name);
  if (existsSync(target)) return;
  await mkdir(dir, { recursive: true });
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, bytes);
    for (let attempt = 1; ; attempt += 1) {
      if (existsSync(target)) return; // another writer won: the same bytes are already there
      try {
        await rename(temp, target);
        return;
      } catch (error) {
        if (existsSync(target)) return;
        const code = codeOf(error);
        if (attempt >= RENAME_TRIES || code === undefined || !BUSY.has(code)) throw error;
        await new Promise<void>((resolve) => setTimeout(resolve, RENAME_WAIT_MS * attempt));
      }
    }
  } finally {
    await rm(temp, { force: true }).catch(() => undefined);
  }
}
