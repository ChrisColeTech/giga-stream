import test, { before } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { PROGRAMMES } from "../../../../scripts/fixtures/fixture-set.mjs";
import { ensureFixtures } from "../../../../scripts/fixtures/make-fixtures.mjs";
import { scanFolder, scanFolderToEnd } from "../src/scan/folder-scan.ts";
import type { ScanEvent } from "../src/types/scan.ts";

// The real fixture files (docs/10 section 2.1), made once per machine and reused.
let fixtures = "";
before(async () => {
  fixtures = (await ensureFixtures()).dir;
});

async function collect(iterable: AsyncIterable<ScanEvent>): Promise<ScanEvent[]> {
  const events: ScanEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

// The set's video files in path order, with their lengths; the caption files beside them are not video.
const VIDEOS = [...PROGRAMMES].sort((a, b) => a.file.localeCompare(b.file));
const COUNT = VIDEOS.length;

test("scanning the fixture folder finds every programme file and probes it with ffprobe", async () => {
  const done = await scanFolderToEnd(fixtures);
  assert.deepEqual(done.files.map((f) => f.path), VIDEOS.map((spec) => spec.file));
  assert.equal(done.unplayable, 0);
  for (const [index, file] of done.files.entries()) {
    const { facts } = file;
    assert.ok(facts, file.path);
    assert.equal(facts.playable, true, file.path);
    assert.deepEqual([facts.videoCodec, facts.audioCodec, facts.width, facts.height, facts.frameRate, facts.audioChannels],
      ["h264", "aac", 1920, 1080, 30, 2], file.path);
    const seconds = VIDEOS[index]?.seconds ?? 0;
    assert.ok(Math.abs((facts.durationMs ?? 0) - seconds * 1000) <= 100, `${file.path} is ${facts.durationMs} ms`);
    assert.ok(file.sizeBytes > 100_000, file.path);
  }
});

test("a scan reports each file found, then each file probed, then done", async () => {
  const events = await collect(scanFolder(fixtures));
  const pairs = (type: string) => Array.from({ length: COUNT }, () => [type, "progress"]).flat();
  assert.deepEqual(events.map((e) => e.type), [...pairs("found"), ...pairs("probed"), "done"]);
  const progress = events.flatMap((e) => (e.type === "progress" ? [[e.found, e.probed, e.total]] : []));
  assert.deepEqual(progress, [
    ...Array.from({ length: COUNT }, (_, i) => [i + 1, 0, null]),
    ...Array.from({ length: COUNT }, (_, i) => [COUNT, i + 1, COUNT]),
  ]);
});

test("in a mixed folder only video files are found; a file that is not video is unplayable, with why", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-media-mixed-"));
  try {
    mkdirSync(path.join(dir, "shows", "season 1"), { recursive: true });
    mkdirSync(path.join(dir, ".hidden"));
    copyFileSync(path.join(fixtures, "live", "news-2.mp4"), path.join(dir, "shows", "season 1", "Episode 1.MP4"));
    writeFileSync(path.join(dir, "broken.mkv"), "this is not a video");
    writeFileSync(path.join(dir, "notes.txt"), "not a video either");
    copyFileSync(path.join(fixtures, "live", "music-1.mp4"), path.join(dir, ".hidden", "skipped.mp4"));
    const done = await scanFolderToEnd(dir);
    assert.deepEqual(done.files.map((f) => [f.path, f.facts?.playable, f.facts?.problem]), [
      ["broken.mkv", false, "The file could not be read as video."],
      ["shows/season 1/Episode 1.MP4", true, undefined],
    ]);
    assert.equal(done.unplayable, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("listing without probing gives the files and no facts", async () => {
  const events = await collect(scanFolder(fixtures, { probe: false }));
  const done = events.at(-1);
  assert.equal(done?.type, "done");
  assert.equal(done?.type === "done" && done.files.length, COUNT);
  assert.equal(done?.type === "done" && done.files.some((f) => f.facts), false);
});

test("aborting after the first probe ends the scan with cancelled and probes no more", async () => {
  const abort = new AbortController();
  const events: ScanEvent[] = [];
  for await (const event of scanFolder(fixtures, { concurrency: 1, signal: abort.signal })) {
    events.push(event);
    if (event.type === "probed") abort.abort();
  }
  assert.equal(events.filter((e) => e.type === "probed").length, 1);
  assert.deepEqual(events.at(-1), { type: "cancelled", found: COUNT, probed: 1 });
});

test("a folder that does not exist rejects before any event", async () => {
  await assert.rejects(collect(scanFolder(path.join(os.tmpdir(), "giga-media-no-such-folder"))));
});
