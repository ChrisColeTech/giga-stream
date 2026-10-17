import { deflateSync } from "node:zlib";

/**
 * The tray icon, generated in code (the repository holds no image files): a 32x32 RGBA bitmap, an amber rounded
 * square with a dark monitor outline, encoded as a PNG with Node's own zlib. Pure: no Electron import, so a plain
 * node test can read the pixels and decode the file.
 */
export const ICON_SIZE = 32;

/** The admin app's `--color-accent` and `--color-accent-ink` (src/admin/src/index.css). */
const AMBER = [0xff, 0xb2, 0x24] as const;
const INK = [0x1f, 0x13, 0x00] as const;
const RADIUS = 7;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type Box = readonly [left: number, top: number, right: number, bottom: number];

const within = (x: number, y: number, [left, top, right, bottom]: Box): boolean =>
  x >= left && x <= right && y >= top && y <= bottom;

const SCREEN_OUTER: Box = [7, 8, 24, 20];
const SCREEN_INNER: Box = [9, 10, 22, 18];
const NECK: Box = [15, 21, 16, 23];
const FOOT: Box = [11, 24, 20, 25];

/** Whether the pixel is inside the rounded square (integer corner arcs, no anti-aliasing). */
export function isInsideSquare(x: number, y: number): boolean {
  const dx = Math.max(RADIUS - x, x - (ICON_SIZE - 1 - RADIUS), 0);
  const dy = Math.max(RADIUS - y, y - (ICON_SIZE - 1 - RADIUS), 0);
  return dx * dx + dy * dy <= RADIUS * RADIUS;
}

/** Whether the pixel belongs to the dark monitor glyph: a 2px screen outline, a neck and a foot. */
export function isGlyph(x: number, y: number): boolean {
  const screen = within(x, y, SCREEN_OUTER) && !within(x, y, SCREEN_INNER);
  return screen || within(x, y, NECK) || within(x, y, FOOT);
}

/** The icon as raw RGBA, row by row, four bytes a pixel. */
export function buildIconBitmap(): Uint8Array {
  const rgba = new Uint8Array(ICON_SIZE * ICON_SIZE * 4);
  for (let y = 0; y < ICON_SIZE; y += 1) {
    for (let x = 0; x < ICON_SIZE; x += 1) {
      if (!isInsideSquare(x, y)) continue;
      const [red, green, blue] = isGlyph(x, y) ? INK : AMBER;
      rgba.set([red, green, blue, 0xff], (y * ICON_SIZE + x) * 4);
    }
  }
  return rgba;
}

const CRC_TABLE: readonly number[] = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

/** The CRC-32 PNG chunks carry (polynomial 0xedb88320). */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** An 8-bit RGBA PNG of the pixels: signature, IHDR, one IDAT (every row filter 0), IEND. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  if (rgba.length !== width * height * 4) throw new RangeError("The pixel data does not match the size.");
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8); // depth 8, colour type 6 (RGBA), deflate, adaptive filtering, no interlace
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row += 1) {
    raw.set(rgba.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1);
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** The tray icon file. */
export function buildIconPng(): Buffer {
  return encodePng(ICON_SIZE, ICON_SIZE, buildIconBitmap());
}
