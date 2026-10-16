/** Named values of the image cache and the stills it keeps (docs/03 section 3.11; 01 section 5). */

/** The cache lives as files under `DATA_DIR/images` (03 section 6); never rows. */
export const IMAGE_DIR_NAME = "images";

/** The source fetch of a known id whose file is absent: bounded in time and size (3.11 defaults). */
export const IMAGE_FETCH_TIMEOUT_MS = 10_000;
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** The long cache lifetime every image answer carries (the value is chosen once, 3.11). */
export const IMAGE_CACHE_SECONDS = 31_536_000;

/** Images older than six months are deleted at start (3.11; `11` section 6). */
export const IMAGE_PRUNE_AGE_MS = 183 * 24 * 60 * 60 * 1000;

/** An image id is a shortened sha-256; files of other shapes are unknown (404 image.not_found). */
export const IMAGE_ID_LENGTH = 32;

/** The still of a local file is one frame as PNG (`poster-fetch`, 3.8). */
export const STILL_SUFFIX = ".png";

/** The image types the cache keeps and serves; another `image/*` subtype is stored without a suffix. */
export const IMAGE_TYPES: ReadonlyMap<string, string> = new Map([
  ["png", "image/png"],
  ["jpeg", "image/jpeg"],
  ["webp", "image/webp"],
  ["gif", "image/gif"],
  ["avif", "image/avif"],
  ["svg+xml", "image/svg+xml"],
]);

/** Content types the answer carries; no entry means the suffix was not one of ours. */
export const CONTENT_TYPES: ReadonlyMap<string, string> = new Map([
  [".png", "image/png"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".avif", "image/avif"],
  [".svg", "image/svg+xml"],
]);

/** The hosts whose plain `http` passes the backend's address rule (03 section 7.3, loopback only). */
export const LOOPBACK_HOSTS: readonly string[] = ["127.0.0.1", "localhost"];
