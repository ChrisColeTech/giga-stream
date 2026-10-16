import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

import { probeFile } from "../../../shared/media/src/probe/probe-file.ts";
import { scanFolderToEnd } from "../../../shared/media/src/scan/folder-scan.ts";
import type { MediaFacts } from "../../../shared/media/src/types/media-facts.ts";
import { CAPTIONS_SUFFIX } from "../constants/media.ts";
import type { Channel } from "../types/channel.ts";
import type { PlaylistItem } from "../types/stream.ts";

/** A video's caption file sits beside it: `clip.mp4` → `clip.en.srt`. */
const captionsBeside = (file: string) => file.replace(/\.[^./\\]+$/, CAPTIONS_SUFFIX);

interface Found {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedMs: number;
  facts?: MediaFacts;
}

function toItem(channel: Channel, file: Found): PlaylistItem {
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
  if (channel.captions) {
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
export async function findChannelVideos(channel: Channel, signal?: AbortSignal): Promise<PlaylistItem[]> {
  if (channel.folder !== undefined) {
    const scan = await scanFolderToEnd(channel.folder, { ...(signal && { signal }) });
    const playable = scan.files.filter((file) => file.facts?.playable);
    if (playable.length === 0) throw new Error(`there is no playable video in ${channel.folder}`);
    return playable.map((file) => toItem(channel, { ...file, name: file.path, path: file.absolutePath }));
  }
  const items: PlaylistItem[] = [];
  for (const file of channel.videos ?? []) {
    const name = path.basename(file);
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) throw new Error(`${file} was not found`);
    const facts = await probeFile(file, signal);
    items.push(toItem(channel, { name, path: file, sizeBytes: info.size, modifiedMs: info.mtimeMs, facts }));
  }
  if (items.length === 0) throw new Error("the channel lists no videos");
  return items;
}
