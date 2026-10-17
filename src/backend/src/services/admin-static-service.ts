import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};
const ASSETS_FOLDER = "assets";
/** Vite fingerprints everything it puts in `assets/`, so those files never change under one name. */
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const REVALIDATE_CACHE = "no-cache";

export interface StaticAnswer {
  body: Buffer;
  contentType: string;
  cacheControl: string;
}

const isFile = async (file: string): Promise<boolean> => (await stat(file).catch(() => null))?.isFile() ?? false;

/** A path that is not a plain relative path under the root: parent steps, backslashes, NUL, dotfiles. */
const isUnsafe = (relative: string): boolean =>
  relative.includes("\0") || relative.includes("\\") || relative.split("/").some((part) => part === ".." || part.startsWith("."));

/**
 * The built admin app (docs/26 section 4.1), served at `/admin/` from `ADMIN_DIST`: a file when the path names
 * one, otherwise `index.html` for a path with no extension (the app has no router, but a reload or a deep
 * link must still open it). With no `index.html` in the folder nothing is served. Node core only.
 */
export function createAdminStatic(root: string) {
  const base = path.resolve(root);
  const indexFile = path.join(base, "index.html");

  async function answer(file: string, cacheControl: string): Promise<StaticAnswer> {
    const contentType = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
    return { body: await readFile(file), contentType, cacheControl };
  }

  return {
    /** Whether a built admin app is there to serve. */
    available: (): Promise<boolean> => isFile(indexFile),

    /** The file for a path below `/admin/` (no leading slash), or null for a 404. */
    async read(relative: string): Promise<StaticAnswer | null> {
      if (!(await isFile(indexFile)) || isUnsafe(relative)) return null;
      const target = path.resolve(base, relative);
      if (relative !== "" && target.startsWith(base + path.sep) && (await isFile(target))) {
        return answer(target, relative.startsWith(`${ASSETS_FOLDER}/`) ? IMMUTABLE_CACHE : REVALIDATE_CACHE);
      }
      // A missing file with an extension is a missing asset; only an app path falls back to the page.
      return path.extname(relative) === "" ? answer(indexFile, REVALIDATE_CACHE) : null;
    },
  };
}

export type AdminStatic = ReturnType<typeof createAdminStatic>;
