import { PLAYLIST_NAME_MAX } from "../constants/limits.js";

const PLAYLIST_EXTENSIONS = [".m3u8", ".m3u"] as const;
const NOT_FILE_NAME_CHARS = /[^a-z0-9._-]+/g;
const COMBINING_MARKS = /\p{M}/gu;
const SEPARATORS = /[\\/]/;

/**
 * The file name a playlist upload is kept under (docs/43 section 3.2): the basename, NFKD with diacritics stripped,
 * lowercase, every run of anything but `a-z0-9._-` becomes `-`, and it must end `.m3u` or `.m3u8`. A name with
 * nothing left of its stem (an all-non-ASCII name) or one too long is refused (`undefined`). The client's name is
 * never a path: nothing is stored under it.
 */
export function sanitizeFileName(raw: string): string | undefined {
  const base = raw.split(SEPARATORS).pop() ?? "";
  const folded = base.normalize("NFKD").replace(COMBINING_MARKS, "").toLowerCase().replace(NOT_FILE_NAME_CHARS, "-");
  const extension = PLAYLIST_EXTENSIONS.find((candidate) => folded.endsWith(candidate));
  if (extension === undefined) return undefined;
  const stem = folded.slice(0, -extension.length).replace(/^-+|-+$/g, "");
  if (!/[a-z0-9]/.test(stem) || stem.length + extension.length > PLAYLIST_NAME_MAX) return undefined;
  return `${stem}${extension}`;
}

/** A web playlist's derived name: the address's last path segment without its extension, else the host. */
export function nameOfUrl(address: URL): string {
  const segment = address.pathname.split("/").filter((part) => part !== "").pop() ?? "";
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    decoded = segment;
  }
  const stem = decoded.replace(/\.[A-Za-z0-9]{1,5}$/, "").trim();
  return (stem === "" ? address.host : stem).slice(0, PLAYLIST_NAME_MAX);
}

/** `name`, or `name (2)`, `name (3)` ... the first the caller does not already hold (a derived name never fails). */
export function uniqueName(name: string, taken: (candidate: string) => boolean): string {
  if (!taken(name)) return name;
  for (let n = 2; ; n += 1) {
    const suffix = ` (${n})`;
    const candidate = `${name.slice(0, PLAYLIST_NAME_MAX - suffix.length)}${suffix}`;
    if (!taken(candidate)) return candidate;
  }
}
