import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PlaylistItem } from "../types/stream.ts";
import type { EncoderInputs } from "./encoder-args.ts";
import type { RecipeChannel } from "./recipe.ts";

const CUE_TIME = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/g;

function stamp(totalMs: number): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(totalMs % 1000, 3)}`;
}

/** An SRT body with every cue time moved later by `offsetMs`. */
export function shiftCaptions(text: string, offsetMs: number): string {
  return text.replace(CUE_TIME, (_, h: string, m: string, s: string, ms: string) =>
    stamp(((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(ms) + offsetMs));
}

/** One SRT of several, each moved to where its video starts and renumbered in order. */
export function joinCaptions(parts: Array<{ text: string; offsetMs: number }>): string {
  let number = 0;
  const cues: string[] = [];
  for (const { text, offsetMs } of parts) {
    for (const block of shiftCaptions(text, offsetMs).replace(/\r/g, "").split(/\n{2,}/)) {
      const lines = block.trim().split("\n");
      if (lines.length < 2) continue;
      const body = /^\d+$/.test(lines[0] ?? "") ? lines.slice(1) : lines;
      number += 1;
      cues.push(`${number}\n${body.join("\n")}\n`);
    }
  }
  return cues.join("\n");
}

/** A concat-demuxer line; a single quote inside the path is closed, escaped and reopened. */
const concatLine = (file: string) => `file '${file.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`;

/**
 * Writes what an encode-mode channel reads into `dir`: `list.txt`, its videos in playlist order for
 * ffmpeg's concat demuxer, and for a captioned channel `captions.srt`, every video's captions moved to
 * where that video starts.
 */
export async function writeEncoderInputs(channel: RecipeChannel, items: PlaylistItem[], dir: string): Promise<EncoderInputs> {
  await mkdir(dir, { recursive: true });
  const listPath = path.join(dir, "list.txt");
  await writeFile(listPath, `${items.map((item) => concatLine(item.path)).join("\n")}\n`);
  if (!channel.captions) return { listPath };
  const parts: Array<{ text: string; offsetMs: number }> = [];
  let offsetMs = 0;
  for (const item of items) {
    if (!item.captionsPath) throw new Error(`${channel.id}: ${item.name} has no captions file`);
    parts.push({ text: await readFile(item.captionsPath, "utf-8"), offsetMs });
    offsetMs += Math.round(item.durationMs);
  }
  const captionsPath = path.join(dir, "captions.srt");
  await writeFile(captionsPath, joinCaptions(parts));
  return { listPath, captionsPath };
}
