// The tray's pure parts (src/app): the generated icon and the menu wording. Electron is never imported.
import assert from "node:assert/strict";
import test from "node:test";
import { inflateSync } from "node:zlib";

import {
  buildIconBitmap,
  buildIconPng,
  crc32,
  encodePng,
  ICON_SIZE,
} from "../src/app/tray-icon.js";
import { trayMenuModel, trayTooltip } from "../src/app/tray-menu.js";

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

interface Chunk {
  type: string;
  data: Buffer;
  crc: number;
  covered: Buffer;
}

function chunksOf(png: Buffer): Chunk[] {
  const chunks: Chunk[] = [];
  let offset = SIGNATURE.length;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const covered = png.subarray(offset + 4, offset + 8 + length);
    chunks.push({
      type: covered.subarray(0, 4).toString("ascii"),
      data: covered.subarray(4),
      crc: png.readUInt32BE(offset + 8 + length),
      covered,
    });
    offset += 12 + length;
  }
  return chunks;
}

function pixel(rgba: Uint8Array, x: number, y: number): number[] {
  const at = (y * ICON_SIZE + x) * 4;
  return Array.from(rgba.subarray(at, at + 4));
}

test("crc32 matches the known check value", () => {
  assert.equal(crc32(Buffer.from("123456789", "ascii")), 0xcbf43926);
});

test("the icon is a valid 32x32 RGBA PNG", () => {
  const png = buildIconPng();
  assert.deepEqual(Array.from(png.subarray(0, 8)), SIGNATURE);
  const chunks = chunksOf(png);
  assert.deepEqual(chunks.map((c) => c.type), ["IHDR", "IDAT", "IEND"]);
  for (const c of chunks) assert.equal(crc32(c.covered), c.crc, `${c.type} crc`);

  const header = chunks[0]!.data;
  assert.equal(header.readUInt32BE(0), 32);
  assert.equal(header.readUInt32BE(4), 32);
  assert.deepEqual(Array.from(header.subarray(8)), [8, 6, 0, 0, 0]);

  const raw = inflateSync(chunks[1]!.data);
  assert.equal(raw.length, 32 * (1 + 32 * 4));
  const bitmap = buildIconBitmap();
  for (let row = 0; row < 32; row += 1) {
    assert.equal(raw[row * 129], 0, "filter byte");
    const encoded = Array.from(raw.subarray(row * 129 + 1, (row + 1) * 129));
    assert.deepEqual(encoded, Array.from(bitmap.subarray(row * 128, (row + 1) * 128)));
  }
});

test("the encoder refuses pixel data of the wrong size", () => {
  assert.throws(() => encodePng(2, 2, new Uint8Array(3)), RangeError);
});

test("the bitmap has transparent corners, an amber body and a dark monitor glyph", () => {
  const rgba = buildIconBitmap();
  assert.equal(rgba.length, 32 * 32 * 4);
  for (const [x, y] of [[0, 0], [31, 0], [0, 31], [31, 31]] as const) {
    assert.equal(pixel(rgba, x, y)[3], 0, `corner ${x},${y}`);
  }
  const amber = [0xff, 0xb2, 0x24, 0xff];
  const ink = [0x1f, 0x13, 0x00, 0xff];
  assert.deepEqual(pixel(rgba, 16, 2), amber, "body above the screen");
  assert.deepEqual(pixel(rgba, 7, 0), amber, "the straight edge begins after the corner arc");
  assert.deepEqual(pixel(rgba, 16, 14), amber, "inside the screen");
  assert.deepEqual(pixel(rgba, 7, 12), ink, "screen outline, left");
  assert.deepEqual(pixel(rgba, 16, 8), ink, "screen outline, top");
  assert.deepEqual(pixel(rgba, 15, 22), ink, "neck");
  assert.deepEqual(pixel(rgba, 11, 24), ink, "foot");
  assert.deepEqual(pixel(rgba, 16, 28), amber, "body below the foot");
});

test("the tray menu is exactly Open and Quit, in that order", () => {
  assert.deepEqual(trayMenuModel().map((item) => item.label), ["Open Giga Stream Admin", "Quit"]);
  assert.deepEqual(trayMenuModel().map((item) => item.action), ["open", "quit"]);
});

test("the tooltip names the app and the backend's address", () => {
  assert.equal(trayTooltip("http://127.0.0.1:3001"), "Giga Stream Admin - http://127.0.0.1:3001");
});
