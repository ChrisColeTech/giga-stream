import { existsSync } from "node:fs";
import path from "node:path";

import { ensureFixtures } from "../fixtures/make-fixtures.mjs";
import { scanFolderToEnd } from "../../src/shared/media/src/scan/folder-scan.ts";

/** A video's caption file sits beside it: `news-1.mp4` → `news-1.en.srt`. */
const captionsBeside = (file) => file.replace(/\.[^./\\]+$/, ".en.srt");

/** One playlist entry: a video the scanner found and ffprobe read. */
function toItem(channel, file) {
  if (!file.facts?.playable) {
    throw new Error(`live-server: ${channel.id}: ${file.path} is not playable: ${file.facts?.problem ?? "not read"}`);
  }
  const item = {
    name: file.path,
    path: file.absolutePath,
    durationMs: file.facts.durationMs,
    sizeBytes: file.sizeBytes,
    modifiedMs: file.modifiedMs,
  };
  if (channel.captions) {
    const captionsPath = captionsBeside(file.absolutePath);
    if (!existsSync(captionsPath)) throw new Error(`live-server: ${channel.id}: ${file.path} has no caption file beside it`);
    item.captionsPath = captionsPath;
  }
  return item;
}

/**
 * Finds and loads every selected channel's playlist (docs/10 section 2, item 3), all through the shared
 * folder scanner, which reads each video's facts with the real ffprobe:
 * - a `playlist` channel: its fixture files, made if missing (section 2.1), in the listed order;
 * - a `folder` channel: every playable video the scanner finds in the folder, in path order.
 * A missing or unplayable video stops the start, naming it. Answers a Map of channel id to its items
 * `[{ name, path, durationMs, sizeBytes, modifiedMs, captionsPath? }]`.
 */
export async function loadChannelPlaylists(channels, { root, log = () => {} } = {}) {
  const loaded = new Map();
  let fixtures = null;
  for (const channel of channels) {
    if (channel.playlist) {
      if (!fixtures) {
        const { dir, made } = await ensureFixtures({ root, log });
        if (made.length > 0) log(`made fixtures: ${made.join(", ")}`);
        const scan = await scanFolderToEnd(dir);
        fixtures = { dir, byPath: new Map(scan.files.map((file) => [file.path, file])) };
      }
      loaded.set(channel.id, channel.playlist.map((name) => {
        const file = fixtures.byPath.get(name);
        if (!file) throw new Error(`live-server: ${channel.id}: fixture ${name} was not found in ${fixtures.dir}`);
        return toItem(channel, file);
      }));
    } else {
      const scan = await scanFolderToEnd(path.resolve(channel.folder));
      const playable = scan.files.filter((file) => file.facts?.playable);
      if (playable.length === 0) throw new Error(`live-server: ${channel.id}: no playable video in ${channel.folder}`);
      if (playable.length < scan.files.length) log(`${channel.id}: skipped ${scan.files.length - playable.length} unplayable file(s)`);
      loaded.set(channel.id, playable.map((file) => toItem(channel, file)));
    }
  }
  return loaded;
}
