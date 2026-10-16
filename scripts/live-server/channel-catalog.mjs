import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Variant ladder every channel draws from: rendition name to picture size and video bitrate. */
export const VARIANT_LADDER = {
  "360p": { width: 640, height: 360, bitrate: "800k" },
  "720p": { width: 1280, height: 720, bitrate: "2500k" },
  "1080p": { width: 1920, height: 1080, bitrate: "5000k" },
};

export const CATEGORIES = ["News", "Sports", "Music", "Kids", "Movies", "Entertainment"];
export const MODES = ["encode", "loop"];

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** A fixture file's path inside the fixture folder (docs/10 section 2.1): relative, `/`, no `..`. */
const FIXTURE_PATH = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/;
const isFixturePath = (value, extension) =>
  typeof value === "string" && FIXTURE_PATH.test(value) && !value.includes("..") && value.endsWith(extension);

const DEFAULT_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "channels.json");

function problemWith(channel, seen) {
  if (typeof channel !== "object" || channel === null) return "is not an object";
  if (typeof channel.id !== "string" || !ID.test(channel.id)) return "id must be kebab-case";
  if (seen.ids.has(channel.id)) return "id is duplicated";
  if (typeof channel.name !== "string" || channel.name.trim() === "") return "name must be a non-empty string";
  if (!Number.isInteger(channel.number) || channel.number < 1) return "number must be a positive integer";
  if (seen.numbers.has(channel.number)) return `number ${channel.number} is duplicated`;
  if (!CATEGORIES.includes(channel.category)) return `category must be one of ${CATEGORIES.join(", ")}`;
  if (!MODES.includes(channel.mode)) return `mode must be one of ${MODES.join(", ")}`;
  // A channel plays a playlist of fixture files, or every video in a folder (docs/10 section 2, item 3).
  const hasPlaylist = channel.playlist !== undefined;
  const hasFolder = channel.folder !== undefined;
  if (hasPlaylist === hasFolder) return "give either a playlist or a folder";
  if (hasPlaylist) {
    if (!Array.isArray(channel.playlist) || channel.playlist.length === 0) return "playlist must list at least one file";
    if (!channel.playlist.every((file) => isFixturePath(file, ".mp4"))) return "playlist entries must be fixture paths ending .mp4";
  }
  if (hasFolder && (typeof channel.folder !== "string" || channel.folder.trim() === "")) return "folder must be a path";
  if (typeof channel.captions !== "boolean") return "captions must be a boolean";
  const { variants } = channel;
  if (!Array.isArray(variants) || variants.length < 2) return "variants must list at least two renditions";
  if (variants.some((name) => !(name in VARIANT_LADDER))) return "variants must come from the ladder";
  if (new Set(variants).size !== variants.length) return "variants must be unique";
  return null;
}

/** Validates a channel list; throws an Error naming the first bad channel and the reason. */
export function validateChannels(list) {
  if (!Array.isArray(list) || list.length === 0) throw new Error("channel-catalog: expected a non-empty array");
  const seen = { ids: new Set(), numbers: new Set() };
  list.forEach((channel, index) => {
    const problem = problemWith(channel, seen);
    if (problem) throw new Error(`channel-catalog: ${channel?.id ?? `entry ${index}`}: ${problem}`);
    seen.ids.add(channel.id);
    seen.numbers.add(channel.number);
  });
  return list;
}

/** Reads and validates channels.json (or another file when given). */
export function loadCatalog(file = DEFAULT_FILE) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, "utf-8"));
  } catch (error) {
    throw new Error(`channel-catalog: cannot read ${file}: ${error.message}`);
  }
  return validateChannels(parsed);
}

/** Picks the requested ids (all when empty); an unknown id is an error. */
export function selectChannels(catalog, ids = []) {
  if (ids.length === 0) return catalog;
  return ids.map((id) => {
    const found = catalog.find((channel) => channel.id === id);
    if (!found) throw new Error(`channel-catalog: unknown channel "${id}"`);
    return found;
  });
}
