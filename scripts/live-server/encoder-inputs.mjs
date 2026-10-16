import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CUE_TIME = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/g;

const msOf = (h, m, s, ms) => ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(ms);

function stamp(totalMs) {
  const pad = (n, width = 2) => String(n).padStart(width, "0");
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(totalMs % 1000, 3)}`;
}

/** An SRT body with every cue time moved later by `offsetMs`. */
export function shiftCaptions(text, offsetMs) {
  return text.replace(CUE_TIME, (_, h, m, s, ms) => stamp(msOf(h, m, s, ms) + offsetMs));
}

/** One SRT of several, each moved to where its video starts and renumbered in order. */
export function joinCaptions(parts) {
  let number = 0;
  const cues = [];
  for (const { text, offsetMs } of parts) {
    for (const block of shiftCaptions(text, offsetMs).replace(/\r/g, "").split(/\n{2,}/)) {
      const lines = block.trim().split("\n");
      if (lines.length < 2) continue;
      const body = /^\d+$/.test(lines[0]) ? lines.slice(1) : lines;
      number += 1;
      cues.push(`${number}\n${body.join("\n")}\n`);
    }
  }
  return cues.join("\n");
}

/** A concat-demuxer line; a single quote inside the path is closed, escaped and reopened. */
const concatLine = (file) => `file '${file.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`;

/**
 * Writes what an encode-mode channel reads (docs/10 section 2, item 3) into `dir`: `list.txt`, its videos
 * in playlist order for ffmpeg's concat demuxer, and for a captioned channel `captions.srt`, every
 * video's captions moved to where that video starts. Answers { listPath, captionsPath? }.
 */
export async function writeEncoderInputs(channel, items, dir) {
  await mkdir(dir, { recursive: true });
  const listPath = path.join(dir, "list.txt");
  await writeFile(listPath, `${items.map((item) => concatLine(item.path)).join("\n")}\n`);
  if (!channel.captions) return { listPath };
  const parts = [];
  let offsetMs = 0;
  for (const item of items) {
    parts.push({ text: await readFile(item.captionsPath, "utf-8"), offsetMs });
    offsetMs += Math.round(item.durationMs);
  }
  const captionsPath = path.join(dir, "captions.srt");
  await writeFile(captionsPath, joinCaptions(parts));
  return { listPath, captionsPath };
}
