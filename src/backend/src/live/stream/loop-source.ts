import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { runTool } from "../../../../shared/media/dist/ffmpeg/run-tool.js";
import { RECIPE_VERSION, SEGMENT_SECONDS } from "../../constants/live-media.js";
import type { LoopSource, PlaylistItem, Rendition } from "../../types/live-stream.js";
import { buildLoopSourceArgs } from "./loop-source-args.js";
import { masterPlaylistUris, parseSegments, renditionIdOf } from "./playlist-parse.js";
import { type RecipeChannel, variantsOf } from "./recipe.js";

const MARKER = "recipe.json";

/**
 * A final segment this short is the AAC encoder's last frame running past the cut (21 ms at 48 kHz). It
 * cannot fill a slot of the live clock, so it is dropped, which keeps every rendition's count the same.
 */
const SLIVER_SECONDS = SEGMENT_SECONDS / 4;

const withoutSliver = (segments: Rendition["segments"]) =>
  segments.length > 1 && (segments.at(-1)?.duration ?? 0) < SLIVER_SECONDS ? segments.slice(0, -1) : segments;

/** What one video's encoded bytes depend on: the recipe, the file itself and the channel's ladder. */
function signature(channel: RecipeChannel, item: PlaylistItem): string {
  const { path: file, sizeBytes, modifiedMs, captionsPath = null } = item;
  const variants = variantsOf(channel);
  return JSON.stringify({ version: RECIPE_VERSION, file, sizeBytes, modifiedMs, captionsPath, variants });
}

async function markerMatches(dir: string, expected: string): Promise<boolean> {
  try {
    return (await readFile(path.join(dir, MARKER), "utf-8")) === expected;
  } catch {
    return false;
  }
}

/**
 * Makes sure the video's VOD ladder is in its own cache folder (under `cacheRoot`, named from its signature,
 * so channels that share a video share its encode). Encodes it once; a marker says the folder is complete,
 * any other state is wiped and rebuilt. Answers the folder. An aborted `signal` kills the encode.
 */
export async function ensureItemSource(
  channel: RecipeChannel,
  item: PlaylistItem,
  cacheRoot: string,
  ffmpegPath: string,
  signal?: AbortSignal,
): Promise<string> {
  const expected = signature(channel, item);
  const cacheDir = path.join(cacheRoot, createHash("sha1").update(expected).digest("hex").slice(0, 16));
  if (await markerMatches(cacheDir, expected)) return cacheDir;
  await rm(cacheDir, { recursive: true, force: true });
  await mkdir(cacheDir, { recursive: true });
  await runTool(ffmpegPath, buildLoopSourceArgs(channel, item), { cwd: cacheDir, ...(signal && { signal }) });
  await writeFile(path.join(cacheDir, MARKER), expected);
  return cacheDir;
}

/** Reads one encoded video: its master text, every rendition's segment list and a byte reader. */
export async function loadLoopSource(cacheDir: string): Promise<LoopSource> {
  const masterText = await readFile(path.join(cacheDir, "master.m3u8"), "utf-8");
  const renditions = new Map<string, Rendition>();
  for (const uri of masterPlaylistUris(masterText)) {
    const segments = withoutSliver(parseSegments(await readFile(path.join(cacheDir, uri), "utf-8")));
    if (segments.length === 0) throw new Error(`${uri} has no segments`);
    renditions.set(renditionIdOf(uri), { uri, segments });
  }
  return {
    masterText,
    renditions,
    async readSegment(id, index) {
      const rendition = renditions.get(id);
      const segment = rendition?.segments[index];
      if (!rendition || !segment) return null;
      const file = path.resolve(cacheDir, path.dirname(rendition.uri), segment.uri);
      if (!file.startsWith(path.resolve(cacheDir) + path.sep)) return null;
      return readFile(file);
    },
  };
}

/**
 * A channel's schedule: its videos' encoded segments in playlist order. Every rendition's list is the
 * videos' lists joined, the first segment of each marked `itemStart` (a switch, so an EXT-X-DISCONTINUITY).
 * The master is the first video's; every video was encoded with the same ladder, so their renditions match.
 */
export function joinSchedule(sources: LoopSource[], items: Array<{ name: string; durationMs: number }>): LoopSource {
  const [first] = sources;
  if (!first) throw new Error("a schedule needs at least one video");
  const ids = [...first.renditions.keys()];
  sources.forEach((source, index) => {
    const name = items[index]?.name ?? `video ${index + 1}`;
    if ([...source.renditions.keys()].join(",") !== ids.join(",")) throw new Error(`${name} has other renditions`);
    // Every rendition must switch videos at the same number, or audio and picture drift apart.
    const counts = new Set([...source.renditions.values()].map((rendition) => rendition.segments.length));
    if (counts.size > 1) throw new Error(`${name}: its renditions differ in segment count`);
  });
  const renditions = new Map<string, Rendition>();
  for (const id of ids) {
    const segments = sources.flatMap((source, item) =>
      (source.renditions.get(id)?.segments ?? []).map((segment, local) => ({ ...segment, item, local, itemStart: local === 0 })));
    renditions.set(id, { uri: first.renditions.get(id)?.uri ?? `${id}/index.m3u8`, segments });
  }
  return {
    masterText: first.masterText,
    renditions,
    items: items.map(({ name, durationMs }) => ({ name, durationMs })),
    async readSegment(id, index) {
      const segment = renditions.get(id)?.segments[index];
      const source = segment?.item === undefined ? undefined : sources[segment.item];
      return source && segment?.local !== undefined ? source.readSegment(id, segment.local) : null;
    },
  };
}

/** Encodes (once) and loads every video of a channel's playlist, and joins them into its schedule. */
export async function loadSchedule(
  channel: RecipeChannel,
  items: PlaylistItem[],
  cacheRoot: string,
  ffmpegPath: string,
  signal?: AbortSignal,
): Promise<LoopSource> {
  const sources: LoopSource[] = [];
  for (const item of items) {
    sources.push(await loadLoopSource(await ensureItemSource(channel, item, cacheRoot, ffmpegPath, signal)));
  }
  return joinSchedule(sources, items);
}
