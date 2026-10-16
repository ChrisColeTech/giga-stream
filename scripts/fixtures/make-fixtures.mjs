#!/usr/bin/env node
// Makes the test video files (docs/10 section 2.1) with the bundled FFmpeg, the way Giga Cut makes its test
// media: once per machine, into a versioned cache under the temp folder, never committed. Each file is
// written beside its final name and renamed into place, so an interrupted run leaves no half file.
// Usage: node scripts/fixtures/make-fixtures.mjs [--force]   (prints the cache folder)
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { locateTool } from "../../src/shared/media/src/ffmpeg/locate-tool.ts";
import { runTool } from "../../src/shared/media/src/ffmpeg/run-tool.ts";
import {
  CAPTION_EVERY_SECONDS,
  FIXTURE_VERSION,
  KEYFRAME_SECONDS,
  LIVE_FPS,
  LIVE_SIZE,
  PROGRAMMES,
  captionsFileOf,
} from "./fixture-set.mjs";

/** The cache folder for this version: `<temp>/giga-stream-fixtures-v<N>`. */
export const fixtureDir = (root = os.tmpdir()) => path.join(root, `giga-stream-fixtures-v${FIXTURE_VERSION}`);

const MARKER = "fixtures.json";

/** What the made files depend on; a different signature remakes them. */
const signature = () => JSON.stringify({ FIXTURE_VERSION, PROGRAMMES, LIVE_SIZE, LIVE_FPS, KEYFRAME_SECONDS });

/** The FFmpeg picture source of a programme, at the fixture size and rate. */
function pictureOf(spec) {
  const size = `size=${LIVE_SIZE.width}x${LIVE_SIZE.height}:rate=${LIVE_FPS}`;
  const source = spec.picture === "color" ? `color=c=${spec.color}:${size}` : `${spec.picture}=${size}`;
  return spec.post ? `${source},${spec.post}` : source;
}

/** The ffmpeg arguments that make one programme into `target`. */
export function programmeArgs(spec, target) {
  return [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-f", "lavfi", "-i", pictureOf(spec),
    "-f", "lavfi", "-i", `sine=frequency=${spec.toneHz}:sample_rate=48000`,
    "-t", String(spec.seconds),
    "-map", "0:v", "-map", "1:a",
    "-c:v", "libx264", "-profile:v", "high", "-preset", "veryfast", "-pix_fmt", "yuv420p",
    "-g", String(LIVE_FPS * KEYFRAME_SECONDS), "-keyint_min", String(LIVE_FPS * KEYFRAME_SECONDS), "-sc_threshold", "0",
    "-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "48000",
    "-movflags", "+faststart", "-f", "mp4", target,
  ];
}

const clock = (seconds) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)},000`;
};

/** An SRT body: one numbered cue every few seconds for the whole programme. */
export function captionText(label, seconds, every = CAPTION_EVERY_SECONDS) {
  const cues = [];
  for (let at = 0, n = 1; at < seconds; at += every, n += 1) {
    cues.push(`${n}\n${clock(at)} --> ${clock(Math.min(at + every, seconds))}\n${label}, caption ${n}\n`);
  }
  return cues.join("\n");
}

async function upToDate(dir) {
  try {
    if ((await readFile(path.join(dir, MARKER), "utf-8")) !== signature()) return false;
  } catch {
    return false;
  }
  return PROGRAMMES.every(
    (spec) => existsSync(path.join(dir, spec.file)) && (!spec.captions || existsSync(path.join(dir, captionsFileOf(spec.file)))),
  );
}

/**
 * Makes sure every fixture file exists in the cache, making what is missing. Answers the folder and the
 * files made. `force` remakes everything.
 */
export async function ensureFixtures({ root, force = false, log = () => {} } = {}) {
  const dir = fixtureDir(root);
  if (!force && (await upToDate(dir))) return { dir, made: [] };
  const ffmpeg = locateTool("ffmpeg");
  await rm(path.join(dir, MARKER), { force: true });
  const made = [];
  for (const spec of PROGRAMMES) {
    const target = path.join(dir, spec.file);
    await mkdir(path.dirname(target), { recursive: true });
    if (force || !existsSync(target)) {
      log(`making ${spec.file}`);
      const partial = `${target}.partial`;
      await runTool(ffmpeg, programmeArgs(spec, partial));
      await rename(partial, target);
      made.push(spec.file);
    }
    if (spec.captions) await writeFile(path.join(dir, captionsFileOf(spec.file)), captionText(spec.captions, spec.seconds));
  }
  await writeFile(path.join(dir, MARKER), signature());
  return { dir, made };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const started = Date.now();
  ensureFixtures({ force: process.argv.includes("--force"), log: (line) => process.stderr.write(`${line}\n`) })
    .then(({ dir, made }) => {
      process.stderr.write(`${made.length} made in ${Math.round((Date.now() - started) / 1000)} s\n`);
      process.stdout.write(`${dir}\n`);
    })
    .catch((error) => {
      process.stderr.write(`make-fixtures: ${error.message}\n`);
      process.exit(1);
    });
}
