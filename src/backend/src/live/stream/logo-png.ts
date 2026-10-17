import { crc32, deflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SIZE = 64;

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** A stable colour per channel id, so each logo is different and repeatable. */
function colourOf(channelId: string): [number, number, number] {
  let hash = 0;
  for (const char of channelId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return [64 + (hash & 127), 64 + ((hash >> 7) & 127), 64 + ((hash >> 14) & 127)];
}

/** A small valid PNG (64x64, solid colour with a lighter inner square) generated in code. */
export function logoPng(channelId: string): Buffer {
  const [red, green, blue] = colourOf(channelId);
  const row = 1 + SIZE * 3;
  const raw = Buffer.alloc(row * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const inner = x >= 16 && x < 48 && y >= 16 && y < 48;
      const at = y * row + 1 + x * 3;
      raw[at] = inner ? 255 : red;
      raw[at + 1] = inner ? 255 : green;
      raw[at + 2] = inner ? 255 : blue;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([SIGNATURE, chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
