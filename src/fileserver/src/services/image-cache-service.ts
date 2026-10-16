import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import type { ServerResponse } from "node:http";
import path from "node:path";

import {
  CONTENT_TYPES,
  IMAGE_CACHE_SECONDS,
  IMAGE_DIR_NAME,
  IMAGE_FETCH_TIMEOUT_MS,
  IMAGE_ID_LENGTH,
  IMAGE_MAX_BYTES,
  IMAGE_PRUNE_AGE_MS,
  LOOPBACK_HOSTS,
} from "../constants/media-cache.js";
import { AppError } from "../lib/app-error.js";

const notFound = (): AppError => new AppError("image.not_found", 404, "There is no image at that id.");

/** An image file name is `<id>` or `<id>.<suffix>`; naming anything else is a foreign file. */
const ID_SHAPE = new RegExp(`^[0-9a-f]{${IMAGE_ID_LENGTH}}$`);
const SUFFIXES: readonly string[] = ["", ...CONTENT_TYPES.keys()];

/** An image id is a stable hash of its source address (docs/03 section 3.11). */
export function imageIdOf(sourceUrl: string): string {
  return createHash("sha256").update(sourceUrl).digest("hex").slice(0, IMAGE_ID_LENGTH);
}

/** A source that passes the backend's address rule (03 section 7.3) is rewritten; others are not. */
export function rewriteImageUrl(sourceUrl: string): string | undefined {
  let address: URL;
  try {
    address = new URL(sourceUrl);
  } catch {
    return undefined;
  }
  if (address.protocol === "https:") return `/api/images/${imageIdOf(sourceUrl)}`;
  if (address.protocol === "http:" && LOOPBACK_HOSTS.includes(address.hostname)) {
    return `/api/images/${imageIdOf(sourceUrl)}`;
  }
  return undefined;
}

export interface ImageCacheService {
  /** `DATA_DIR/images` — the one folder where backend-derived bytes live (docs/01 section 7). */
  dir: string;
  /** A rewrite's source: serving later may fetch it when the file is absent. */
  rememberSource: (sourceUrl: string) => void;
  /** A still written straight into the cache (no fetch); its bytes are PNG (3.11). */
  rememberStill: (id: string) => void;
  /** True when some cached file stands behind the id. */
  has: (id: string) => boolean;
  /** Serves `GET|HEAD /api/images/:imageId` (3.11); an unknown id or a failed source is 404. */
  serve: (id: string, head: boolean, response: ServerResponse) => Promise<void>;
  /** Deletes images older than six months; called once at start (3.11, `11` section 6). */
  prune: () => void;
}

export function createImageCacheService(deps: { dataDir: string; fetch?: typeof fetch; now: () => number }): ImageCacheService {
  const dir = path.join(deps.dataDir, IMAGE_DIR_NAME);
  mkdirSync(dir, { recursive: true });
  const doFetch = deps.fetch ?? globalThis.fetch;
  /** id -> the source address and the content type that was last known for the id. */
  const sources = new Map<string, { url?: string; contentType?: string }>();

  function fileOf(id: string): string | null {
    for (const suffix of SUFFIXES) {
      const candidate = path.join(dir, `${id}${suffix}`);
      if (existsSync(candidate)) return candidate;
    }
    return null;
  }

  function suffixOf(contentType: string | undefined): string {
    const subtype = (contentType ?? "").replace(/^image\//, "").split(";")[0]?.trim() ?? "";
    return SUFFIXES.find((suffix) => CONTENT_TYPES.get(suffix) === `image/${subtype}`) ?? "";
  }

  function headers(file: string, id: string, contentType: string): Record<string, string> {
    return {
      "content-type": contentType,
      "cache-control": `public, max-age=${IMAGE_CACHE_SECONDS}`,
      etag: `"${id}"`,
    };
  }

  /** Reads at most `IMAGE_MAX_BYTES` bytes; `null` when the body is bigger (3.11's cap). */
  async function boundedBytes(response: Response): Promise<Uint8Array | null> {
    if (response.body === null) return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > IMAGE_MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  }

  return {
    dir,

    rememberSource(sourceUrl) {
      const rewritten = rewriteImageUrl(sourceUrl);
      if (rewritten === undefined) return;
      const id = imageIdOf(sourceUrl);
      const known = sources.get(id) ?? {};
      if (known.url === undefined) sources.set(id, { ...known, url: sourceUrl });
    },

    rememberStill(id) {
      const known = sources.get(id) ?? {};
      sources.set(id, { ...known, contentType: "image/png" });
    },

    has(id) {
      return fileOf(id) !== null;
    },

    async serve(id, head, response) {
      if (!ID_SHAPE.test(id)) throw notFound();
      let file = fileOf(id);
      if (file === null) {
        const known = sources.get(id);
        if (known?.url === undefined) throw notFound();
        let answer: Response | undefined;
        try {
          answer = await doFetch(known.url, {
            method: "GET",
            credentials: "omit",
            redirect: "error",
            signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
          });
        } catch {
          throw notFound();
        }
        const contentType = (answer.ok ? (answer.headers.get("content-type") ?? "") : "").toLowerCase();
        if (!contentType.startsWith("image/")) throw notFound();
        const bytes = await boundedBytes(answer);
        if (bytes === null) throw notFound();
        sources.set(id, { ...known, contentType });
        file = path.join(dir, `${id}${suffixOf(contentType)}`);
        writeFileSync(file, bytes);
      }
      const size = statSync(file).size;
      const contentType =
        sources.get(id)?.contentType ?? CONTENT_TYPES.get(path.extname(file)) ?? "application/octet-stream";
      response.writeHead(200, { ...headers(file, id, contentType), "content-length": String(size) });
      if (head) {
        response.end();
        return;
      }
      const stream = createReadStream(file);
      stream.pipe(response);
      await new Promise<void>((resolve) => stream.on("close", resolve));
    },

    prune() {
      const cutoff = deps.now() - IMAGE_PRUNE_AGE_MS;
      for (const name of readdirSync(dir)) {
        const file = path.join(dir, name);
        try {
          if (statSync(file).mtimeMs < cutoff) unlinkSync(file);
        } catch {
          // A handle may hold the file a moment longer; it is gone by the next start.
        }
      }
    },
  };
}
