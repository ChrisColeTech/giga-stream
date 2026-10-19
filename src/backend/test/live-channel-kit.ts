/** Bodies and files for the live channel tests: real paths the checks can see, with nothing in them to encode. */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";

import { removeDir } from "./db-kit.js";
import { pick } from "./test-app.js";

const dir = mkdtempSync(path.join(os.tmpdir(), "giga-live-videos-"));
mkdirSync(path.join(dir, "folder"));
for (const file of ["a.mp4", "b.mp4", "broken-1.mp4", path.join("folder", "x.mp4"), path.join("folder", "y.mp4")]) {
  writeFileSync(path.join(dir, file), "not a video: the fake build never reads it");
}
after(() => removeDir(dir));

export const VIDEOS = {
  dir,
  folder: path.join(dir, "folder"),
  a: path.join(dir, "a.mp4"),
  b: path.join(dir, "b.mp4"),
  broken: path.join(dir, "broken-1.mp4"),
};

/** A live channel body; an overridden `undefined` drops the field. */
export const liveBody = (overrides: Record<string, unknown> = {}) => ({
  kind: "live",
  id: "home",
  name: "Home Videos",
  category: "Entertainment",
  number: 7,
  videos: [VIDEOS.a, VIDEOS.b],
  ...overrides,
});

/** A stream channel body, as every body was before live channels (no `kind`). */
export const streamBody = (overrides: Record<string, unknown> = {}) => ({
  name: "News",
  category: "News",
  number: "7",
  streamUrl: "https://live.example/news.m3u8",
  ...overrides,
});

/** The items of a channel list answer, as plain records. */
export function itemsOf(body: unknown): Array<Record<string, unknown>> {
  const list = pick(body, "data.items");
  if (!Array.isArray(list)) throw new Error("not a channel list");
  return list.map((entry): Record<string, unknown> => (typeof entry === "object" && entry !== null ? { ...entry } : {}));
}

/** The item of a channel list with this id. */
export function itemOf(body: unknown, id: string): Record<string, unknown> {
  const found = itemsOf(body).find((item) => item.id === id);
  if (!found) throw new Error(`no channel ${id} in the list`);
  return found;
}
