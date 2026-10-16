import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { runTool } from "../../src/shared/media/src/ffmpeg/run-tool.ts";
import { RECIPE_VERSION, SEGMENT_SECONDS, variantsOf } from "./channel-recipe.mjs";
import { buildLoopSourceArgs } from "./loop-source-args.mjs";
import { masterPlaylistUris, parseSegments, renditionIdOf } from "./playlist-parse.mjs";

const MARKER = "recipe.json";

/** What one video's encoded bytes depend on: the recipe, the file itself and the channel's ladder. */
function signature(channel, item) {
  const { path: file, sizeBytes, modifiedMs, captionsPath = null } = item;
  return JSON.stringify({ version: RECIPE_VERSION, file, sizeBytes, modifiedMs, captionsPath, variants: variantsOf(channel) });
}

async function markerMatches(dir, expected) {
  try {
    return (await readFile(path.join(dir, MARKER), "utf-8")) === expected;
  } catch {
    return false;
  }
}

/**
 * Makes sure the video's VOD ladder is in its own cache folder (under `cacheRoot`, named from its signature,
 * so channels that share a video share its encode). Encodes it once; a marker says the folder is complete,
 * any other state is wiped and rebuilt. Answers the folder.
 */
export async function ensureItemSource({ channel, item, cacheRoot, ffmpegPath, run = runTool }) {
  const expected = signature(channel, item);
  const cacheDir = path.join(cacheRoot, createHash("sha1").update(expected).digest("hex").slice(0, 16));
  if (await markerMatches(cacheDir, expected)) return cacheDir;
  await rm(cacheDir, { recursive: true, force: true });
  await mkdir(cacheDir, { recursive: true });
  await run(ffmpegPath, buildLoopSourceArgs(channel, item), { cwd: cacheDir });
  await writeFile(path.join(cacheDir, MARKER), expected);
  return cacheDir;
}

/**
 * A final segment this short is the AAC encoder's last frame running past the cut (21 ms at 48 kHz). It
 * cannot fill a slot of the live clock, so it is dropped, which keeps every rendition's count the same.
 */
const SLIVER_SECONDS = SEGMENT_SECONDS / 4;

const withoutSliver = (segments) =>
  segments.length > 1 && segments.at(-1).duration < SLIVER_SECONDS ? segments.slice(0, -1) : segments;

/** Reads one encoded video: its master text, every rendition's segment list and a byte reader. */
export async function loadLoopSource(cacheDir) {
  const masterText = await readFile(path.join(cacheDir, "master.m3u8"), "utf-8");
  const renditions = new Map();
  for (const uri of masterPlaylistUris(masterText)) {
    const segments = withoutSliver(parseSegments(await readFile(path.join(cacheDir, uri), "utf-8")));
    if (segments.length === 0) throw new Error(`loop-source: ${uri} has no segments`);
    renditions.set(renditionIdOf(uri), { uri, segments });
  }
  return {
    masterText,
    renditions,
    async readSegment(id, index) {
      const rendition = renditions.get(id);
      const segment = rendition?.segments[index];
      if (!segment) return null;
      const file = path.resolve(cacheDir, path.dirname(rendition.uri), segment.uri);
      if (!file.startsWith(path.resolve(cacheDir) + path.sep)) return null;
      return readFile(file);
    },
  };
}

/**
 * A channel's schedule (docs/10 section 2, item 4): its videos' encoded segments in playlist order. Every
 * rendition's list is the items' lists joined, the first segment of each video marked `itemStart` (a switch,
 * so an EXT-X-DISCONTINUITY). The master is the first video's; every video was encoded with the same ladder,
 * so their renditions match. `items` gives each video's name, length and first schedule segment (by the
 * first video rendition's numbering).
 */
export function joinSchedule(sources, items) {
  const [first] = sources;
  const ids = [...first.renditions.keys()];
  for (const [index, source] of sources.entries()) {
    const other = [...source.renditions.keys()];
    if (other.join(",") !== ids.join(",")) throw new Error(`loop-source: ${items[index].name} has renditions ${other.join(", ")}`);
    // Every rendition must switch videos at the same number, or audio and picture drift apart.
    const counts = new Set([...source.renditions.values()].map((rendition) => rendition.segments.length));
    if (counts.size > 1) throw new Error(`loop-source: ${items[index].name} renditions differ in segment count`);
  }
  const renditions = new Map();
  for (const id of ids) {
    const segments = sources.flatMap((source, item) =>
      source.renditions.get(id).segments.map((segment, local) => ({ ...segment, item, local, itemStart: local === 0 })));
    renditions.set(id, { uri: first.renditions.get(id).uri, segments });
  }
  const timeline = renditions.get(ids[0]).segments;
  const schedule = items.map((item, index) => ({
    name: item.name,
    durationMs: item.durationMs,
    firstSegment: timeline.findIndex((segment) => segment.item === index),
  }));
  return {
    masterText: first.masterText,
    renditions,
    items: schedule,
    async readSegment(id, index) {
      const segment = renditions.get(id)?.segments[index];
      return segment ? sources[segment.item].readSegment(id, segment.local) : null;
    },
  };
}

/** Encodes (once) and loads every video of a channel's playlist, and joins them into its schedule. */
export async function loadSchedule({ channel, items, cacheRoot, ffmpegPath }) {
  const sources = [];
  for (const item of items) {
    sources.push(await loadLoopSource(await ensureItemSource({ channel, item, cacheRoot, ffmpegPath })));
  }
  return joinSchedule(sources, items);
}
