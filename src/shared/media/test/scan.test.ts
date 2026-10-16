import test, { before } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

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

test("scanning the fixture folder finds the four live files and probes them with ffprobe", async () => {
  const done = await scanFolderToEnd(fixtures);
  assert.deepEqual(done.files.map((f) => f.path), ["live/kids.mp4", "live/music.mp4", "live/news.mp4", "live/sports.mp4"]);
  assert.equal(done.unplayable, 0);
  for (const file of done.files) {
    const { facts } = file;
    assert.ok(facts, file.path);
    assert.equal(facts.playable, true, file.path);
    assert.deepEqual([facts.videoCodec, facts.audioCodec, facts.width, facts.height, facts.frameRate, facts.audioChannels],
      ["h264", "aac", 1920, 1080, 30, 2], file.path);
    assert.ok(Math.abs((facts.durationMs ?? 0) - 60_000) <= 100, `${file.path} is ${facts.durationMs} ms`);
    assert.ok(file.sizeBytes > 100_000, file.path);
  }
});

test("a scan reports each file found, then each file probed, then done", async () => {
  const events = await collect(scanFolder(fixtures));
  assert.deepEqual(events.map((e) => e.type), [
    "found", "progress", "found", "progress", "found", "progress", "found", "progress",
    "probed", "progress", "probed", "progress", "probed", "progress", "probed", "progress",
    "done",
  ]);
  const progress = events.flatMap((e) => (e.type === "progress" ? [[e.found, e.probed, e.total]] : []));
  assert.deepEqual(progress, [
    [1, 0, null], [2, 0, null], [3, 0, null], [4, 0, null], [4, 1, 4], [4, 2, 4], [4, 3, 4], [4, 4, 4],
  ]);
});

test("in a mixed folder only video files are found; a file that is not video is unplayable, with why", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-media-mixed-"));
  try {
    mkdirSync(path.join(dir, "shows", "season 1"), { recursive: true });
    mkdirSync(path.join(dir, ".hidden"));
    copyFileSync(path.join(fixtures, "live", "news.mp4"), path.join(dir, "shows", "season 1", "Episode 1.MP4"));
    writeFileSync(path.join(dir, "broken.mkv"), "this is not a video");
    writeFileSync(path.join(dir, "notes.txt"), "not a video either");
    copyFileSync(path.join(fixtures, "live", "music.mp4"), path.join(dir, ".hidden", "skipped.mp4"));
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
  assert.equal(done?.type === "done" && done.files.length, 4);
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
  assert.deepEqual(events.at(-1), { type: "cancelled", found: 4, probed: 1 });
});

test("a folder that does not exist rejects before any event", async () => {
  await assert.rejects(collect(scanFolder(path.join(os.tmpdir(), "giga-media-no-such-folder"))));
});
