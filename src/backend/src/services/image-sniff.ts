export type ImageExt = "png" | "jpg" | "gif" | "webp";

const startsWith = (bytes: Buffer, signature: readonly number[], at = 0): boolean =>
  signature.every((byte, i) => bytes[at + i] === byte);

/**
 * The extension a cached logo gets, chosen from its first bytes and never from the upstream header: PNG, JPEG, GIF and
 * WebP only (docs/43 section 3.1). SVG, or anything else a server calls an image, is `undefined` and is not cached.
 */
export function sniffImage(bytes: Buffer): ImageExt | undefined {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return "gif";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return undefined;
}

export const IMAGE_TYPES: Record<ImageExt, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};
