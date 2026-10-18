import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  LOGO_CACHE_DIR, LOGO_CACHE_HASH_CHARS, LOGO_CACHE_NAME, LOGO_FETCH_TIMEOUT_MS, LOGO_MAX_BYTES, LOGO_RECHECK_MS,
} from "../constants/limits.js";
import type { Store } from "../store/store.js";
import type { SyncRun } from "../types/sync-run.js";
import { IMAGE_TYPES, sniffImage } from "./image-sniff.js";
import type { RequestLimiter } from "./request-limiter.js";
import type { SafeFetch } from "./safe-fetch.js";

/**
 * Step 4: the logo bytes, cached on the backend (docs/43 sections 3.1 and 3.4). A distinct logo address is downloaded
 * when it was never checked, was checked over 7 days ago, or its cached file is gone; the answer must be a 2xx `image/*`
 * of at most 1 MiB whose first bytes are PNG, JPEG, GIF or WebP (SVG is never cached). The file is named by the first 32
 * hex characters of the content hash with the extension those bytes chose, and written once, atomically. A failure
 * stamps the check time only, so the old file stays. Garbage collection (no age guard) deletes files no channel names.
 */
export function createLogoCache(deps: {
  store: Store;
  safeFetch: SafeFetch;
  limiter: RequestLimiter;
  dataDir: string;
  now: () => number;
}) {
  const { store, safeFetch, limiter, now } = deps;
  const dir = path.join(deps.dataDir, LOGO_CACHE_DIR);

  async function download(url: string, signal: AbortSignal): Promise<string | undefined> {
    const answer = await safeFetch(url, { timeoutMs: LOGO_FETCH_TIMEOUT_MS, maxBytes: LOGO_MAX_BYTES, signal, headers: { Accept: "image/*" } });
    const type = answer.headers["content-type"] ?? "";
    const ext = sniffImage(answer.body);
    if (answer.status < 200 || answer.status >= 300 || !type.toLowerCase().startsWith("image/") || ext === undefined) return undefined;
    const name = `${createHash("sha256").update(answer.body).digest("hex").slice(0, LOGO_CACHE_HASH_CHARS)}.${ext}`;
    const target = path.join(dir, name);
    if (!existsSync(target)) {
      await mkdir(dir, { recursive: true });
      const temp = `${target}.${randomUUID()}.tmp`;
      await writeFile(temp, answer.body);
      await rename(temp, target);
    }
    return name;
  }

  /** Deletes the cache files no channel references. Run only at the end of a sync run, never in a delete handler. */
  function collect(): void {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    const kept = store.health.referencedLogoFiles();
    for (const name of names) {
      if (!LOGO_CACHE_NAME.test(name) || kept.has(name)) continue;
      try {
        unlinkSync(path.join(dir, name));
      } catch {
        // a file already gone or held open: the next run collects it
      }
    }
  }

  return {
    /** Step 4 and the collection after it; answers how many addresses were cached and how many failed. */
    async run(run: SyncRun): Promise<{ cached: number; failed: number }> {
      const cutoff = now() - LOGO_RECHECK_MS;
      const due = new Set<string>();
      for (const t of store.health.logoTargets(run.playlistId)) {
        if (t.checkedAt === null || t.checkedAt < cutoff || (t.file !== null && !existsSync(path.join(dir, t.file)))) due.add(t.url);
      }
      let cached = 0;
      let failed = 0;
      let finished = 0;
      run.report({ phase: "logos", done: 0, total: due.size });
      await Promise.all([...due].map((url) =>
        limiter.run(URL.canParse(url) ? new URL(url).host : "", async () => {
          if (run.signal.aborted || now() >= run.endsAt) return;
          let name: string | undefined;
          try {
            name = await download(url, run.signal);
          } catch {
            if (run.signal.aborted) return;
          }
          if (name === undefined) {
            failed += 1;
            store.health.stampLogo(run.playlistId, url, now());
          } else {
            cached += 1;
            store.health.cacheLogo(run.playlistId, url, name, now());
          }
        }).catch(() => undefined).finally(() => run.report({ phase: "logos", done: ++finished, total: due.size })),
      ));
      collect();
      return { cached, failed };
    },

    collect,

    /** A cached image's bytes, or undefined: the name must be exactly a cache name, so nothing outside the folder is read. */
    async read(name: string): Promise<{ bytes: Buffer; type: string } | undefined> {
      if (!LOGO_CACHE_NAME.test(name)) return undefined;
      try {
        const bytes = await readFile(path.join(dir, name));
        const ext = sniffImage(bytes);
        return ext === undefined ? undefined : { bytes, type: IMAGE_TYPES[ext] };
      } catch {
        return undefined;
      }
    },
  };
}

export type LogoCache = ReturnType<typeof createLogoCache>;
