// The live server's first real test (docs/10 section 2.1): it finds and loads the real fixture files through
// the shared scanner (real ffprobe), encodes them, and serves them as live HLS. No fakes: the files, the
// encoder and the HTTP server are the real ones. The first run on a machine makes the files and encodes the
// loop sources (minutes); later runs reuse both caches.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import { locateTool } from "../../../src/shared/media/src/ffmpeg/locate-tool.ts";
import { runTool } from "../../../src/shared/media/src/ffmpeg/run-tool.ts";
import { loadCatalog } from "../channel-catalog.mjs";
import { loadChannelFixtures } from "../channel-fixtures.mjs";
import { DEFAULT_OUT_DIR, startLiveServer } from "../live-server.mjs";

let live;
before(async () => {
  // The loop sources are cached in the default output folder, as a developer's run caches them.
  live = await startLiveServer({ mode: "loop", port: 0, outDir: DEFAULT_OUT_DIR });
});
after(async () => {
  await live?.stop();
});

const text = async (url) => {
  const response = await fetch(url);
  assert.equal(response.status, 200, url);
  return response.text();
};

test("every channel's fixture file is found by the scanner and loaded with its real facts", async () => {
  const loaded = await loadChannelFixtures(loadCatalog());
  assert.deepEqual([...loaded.keys()], ["fx-news", "fx-sports", "fx-music", "fx-kids"]);
  for (const [id, fixture] of loaded) {
    assert.ok(path.isAbsolute(fixture.path), id);
    assert.ok(Math.abs(fixture.durationMs - 60_000) <= 100, `${id} lasts ${fixture.durationMs} ms`);
    assert.ok(fixture.sizeBytes > 100_000, id);
  }
  assert.match(loaded.get("fx-news").captionsPath, /news\.en\.srt$/);
  assert.equal(loaded.get("fx-sports").captionsPath, undefined);
});

test("a channel whose fixture file does not exist stops the start, naming it", async () => {
  const [news] = loadCatalog();
  await assert.rejects(loadChannelFixtures([{ ...news, file: "live/missing.mp4" }]), /fx-news: fixture live\/missing\.mp4 was not found/);
});

test("the server lists the four channels, live, in loop mode", async () => {
  const listed = JSON.parse(await text(`${live.url}/channels.json`));
  const items = listed.channels ?? listed;
  assert.deepEqual(items.map((c) => c.id), ["fx-news", "fx-sports", "fx-music", "fx-kids"]);
});

test("each channel's master lists its variants and audio; news also its captions", async () => {
  for (const [id, variants] of [["fx-news", 2], ["fx-sports", 3], ["fx-music", 2], ["fx-kids", 2]]) {
    const master = await text(`${live.url}/live/${id}/master.m3u8`);
    assert.equal(master.match(/#EXT-X-STREAM-INF:[^\n]*RESOLUTION=/g)?.length, variants, id);
    assert.match(master, /TYPE=AUDIO/, id);
    assert.equal(/TYPE=SUBTITLES/.test(master), id === "fx-news", id);
  }
});

test("a live playlist is a moving window over the file, and its segment is real H.264 video", async () => {
  const media = await text(`${live.url}/live/fx-sports/720p/index.m3u8`);
  assert.equal(media.includes("#EXT-X-ENDLIST"), false, "live: no end");
  const segment = media.split("\n").find((line) => line.trim() && !line.startsWith("#"));
  assert.ok(segment, "the window has a segment");
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-live-segment-"));
  try {
    const bytes = Buffer.from(await (await fetch(`${live.url}/live/fx-sports/720p/${segment.trim()}`)).arrayBuffer());
    assert.ok(bytes.length > 10_000);
    const file = path.join(dir, "segment.ts");
    (await import("node:fs")).writeFileSync(file, bytes);
    const { stdout } = await runTool(locateTool("ffprobe"), ["-v", "error", "-show_streams", "-of", "json", file], { captureStdout: true });
    const video = JSON.parse(stdout).streams.find((s) => s.codec_type === "video");
    assert.deepEqual([video?.codec_name, video?.width, video?.height], ["h264", 1280, 720]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
