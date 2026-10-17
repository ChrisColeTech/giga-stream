import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

import { probeFile } from "../../../../shared/media/dist/probe/probe-file.js";
import { scanFolderToEnd } from "../../../../shared/media/dist/scan/folder-scan.js";
import type { MediaFacts } from "../../../../shared/media/dist/types/media-facts.js";
import { CAPTIONS_SUFFIX } from "../../constants/live-media.js";
import type { LiveSpec, PlaylistItem } from "../../types/live-stream.js";

/** A video's caption file sits beside it: `clip.mp4` becomes `clip.en.srt`. */
const captionsBeside = (file: string) => file.replace(/\.[^./\\]+$/, CAPTIONS_SUFFIX);

interface Found {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedMs: number;
  facts?: MediaFacts;
}

function toItem(spec: LiveSpec, file: Found): PlaylistItem {
  if (!file.facts?.playable || file.facts.durationMs === undefined) {
    throw new Error(`${file.name} cannot be played: ${file.facts?.problem ?? "it was not read"}`);
  }
  const item: PlaylistItem = {
    name: file.name,
    path: file.path,
    durationMs: file.facts.durationMs,
    sizeBytes: file.sizeBytes,
    modifiedMs: file.modifiedMs,
  };
  if (spec.captions) {
    const captionsPath = captionsBeside(file.path);
    if (!existsSync(captionsPath)) throw new Error(`${file.name} has no caption file beside it`);
    item.captionsPath = captionsPath;
  }
  return item;
}

/**
 * Finds and reads a channel's videos with the shared media library (real ffprobe), in play order:
 * - a `folder` channel: every playable video the scanner finds there, in path order (others are skipped);
 * - a `videos` channel: each listed file, in the listed order; a missing or unplayable one is an error.
 * Throws a sentence naming the problem; the caller shows it as the channel's problem.
 */
export async function findChannelVideos(spec: LiveSpec, signal?: AbortSignal): Promise<PlaylistItem[]> {
  if (spec.folder !== undefined) {
    const scan = await scanFolderToEnd(spec.folder, { ...(signal && { signal }) });
    const playable = scan.files.filter((file) => file.facts?.playable);
    if (playable.length === 0) throw new Error(`there is no playable video in ${spec.folder}`);
    return playable.map((file) => toItem(spec, { ...file, name: file.path, path: file.absolutePath }));
  }
  const items: PlaylistItem[] = [];
  for (const file of spec.videos ?? []) {
    const name = path.basename(file);
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) throw new Error(`${file} was not found`);
    const facts = await probeFile(file, signal);
    items.push(toItem(spec, { name, path: file, sizeBytes: info.size, modifiedMs: info.mtimeMs, facts }));
  }
  if (items.length === 0) throw new Error("the channel lists no videos");
  return items;
}
