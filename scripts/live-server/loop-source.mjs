import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { runTool } from "../../src/shared/media/src/ffmpeg/run-tool.ts";
import { RECIPE_VERSION, variantsOf } from "./channel-recipe.mjs";
import { buildLoopSourceArgs } from "./loop-source-args.mjs";
import { masterPlaylistUris, parseSegments, renditionIdOf } from "./playlist-parse.mjs";

const MARKER = "recipe.json";

/** What the encoded bytes depend on: the recipe and the fixture file itself. A change re-encodes. */
function signature(channel, fixture) {
  const { path: file, sizeBytes, modifiedMs, captionsPath = null } = fixture;
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
 * Makes sure `<cacheDir>` holds the channel's loop source, encoding its fixture file once. A marker file
 * with the signature says the folder is complete; any other state is wiped and rebuilt. Answers true when
 * it encoded, false when it reused the cache.
 */
export async function ensureLoopSource({ channel, fixture, cacheDir, ffmpegPath, run = runTool }) {
  const expected = signature(channel, fixture);
  if (await markerMatches(cacheDir, expected)) return false;
  await rm(cacheDir, { recursive: true, force: true });
  await mkdir(cacheDir, { recursive: true });
  await run(ffmpegPath, buildLoopSourceArgs(channel, fixture), { cwd: cacheDir });
  await writeFile(path.join(cacheDir, MARKER), expected);
  return true;
}

/**
 * Reads an encoded source: the master text, every rendition's segment list and a byte reader.
 * Renditions are keyed by their id (`360p`, `audio`, the subtitle playlists ffmpeg wrote).
 */
export async function loadLoopSource(cacheDir) {
  const masterText = await readFile(path.join(cacheDir, "master.m3u8"), "utf-8");
  const renditions = new Map();
  for (const uri of masterPlaylistUris(masterText)) {
    const segments = parseSegments(await readFile(path.join(cacheDir, uri), "utf-8"));
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
