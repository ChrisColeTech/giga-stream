// The live server's first real test (docs/10 section 2.1): it finds and loads the real fixture files through
// the shared scanner (real ffprobe), encodes them, and serves each channel's playlist as live HLS. No fakes:
// the files, the encoder and the HTTP server are the real ones. The first run on a machine makes the files
// and encodes every video once (minutes); later runs reuse both caches.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import { locateTool } from "../../../src/shared/media/src/ffmpeg/locate-tool.ts";
import { runTool } from "../../../src/shared/media/src/ffmpeg/run-tool.ts";
import { loadCatalog } from "../channel-catalog.mjs";
import { loadChannelPlaylists } from "../channel-playlist.mjs";
import { writeEncoderInputs } from "../encoder-inputs.mjs";
import { DEFAULT_OUT_DIR, startLiveServer } from "../live-server.mjs";

// The clock runs `shift` ahead of the wall, so a test can move a channel to just before a switch.
const shift = { ms: 0 };
let live;
before(async () => {
  // The encoded videos are cached in the default output folder, as a developer's run caches them.
  live = await startLiveServer({ mode: "loop", port: 0, outDir: DEFAULT_OUT_DIR, clock: () => Date.now() + shift.ms });
});
after(async () => {
  await live?.stop();
});

const text = async (url) => {
  const response = await fetch(url);
  assert.equal(response.status, 200, url);
  return response.text();
};
const listed = async () => JSON.parse(await text(`${live.url}/channels.json`)).channels;

/** ffprobe's video stream of a segment fetched from the server. */
async function probeSegment(url) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-live-segment-"));
  try {
    const response = await fetch(url);
    assert.equal(response.status, 200, url);
    const file = path.join(dir, "segment.ts");
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
    const { stdout } = await runTool(locateTool("ffprobe"), ["-v", "error", "-show_streams", "-of", "json", file], { captureStdout: true });
    return JSON.parse(stdout).streams.find((stream) => stream.codec_type === "video");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("every channel's playlist is found by the scanner and loaded with its real facts, in order", async () => {
  const loaded = await loadChannelPlaylists(loadCatalog());
  assert.deepEqual([...loaded.keys()], ["fx-news", "fx-sports", "fx-music", "fx-kids"]);
  const news = loaded.get("fx-news");
  assert.deepEqual(news.map((item) => item.name), ["live/news-1.mp4", "live/news-2.mp4", "live/news-3.mp4"]);
  for (const [item, seconds] of news.map((item, index) => [item, [30, 20, 40][index]])) {
    assert.ok(path.isAbsolute(item.path), item.name);
    assert.ok(Math.abs(item.durationMs - seconds * 1000) <= 100, `${item.name} lasts ${item.durationMs} ms`);
    assert.ok(item.sizeBytes > 100_000, item.name);
    assert.match(item.captionsPath, /news-\d\.en\.srt$/);
  }
  assert.equal(loaded.get("fx-sports")[0].captionsPath, undefined);
});

test("a playlist entry that does not exist stops the start, naming it", async () => {
  const [news] = loadCatalog();
  await assert.rejects(
    loadChannelPlaylists([{ ...news, playlist: ["live/news-1.mp4", "live/missing.mp4"] }]),
    /fx-news: fixture live\/missing\.mp4 was not found/,
  );
});

test("the server lists the four channels with their playlists and what each is playing", async () => {
  const channels = await listed();
  assert.deepEqual(channels.map((c) => c.id), ["fx-news", "fx-sports", "fx-music", "fx-kids"]);
  for (const channel of channels) {
    assert.equal(channel.playlist.length, 3, channel.id);
    assert.ok(channel.nowPlaying && channel.playlist[channel.nowPlaying.index].name === channel.nowPlaying.name, channel.id);
  }
});

test("each channel's master lists its variants and audio; news also its captions", async () => {
  for (const [id, variants] of [["fx-news", 2], ["fx-sports", 3], ["fx-music", 2], ["fx-kids", 2]]) {
    const master = await text(`${live.url}/live/${id}/master.m3u8`);
    assert.equal(master.match(/#EXT-X-STREAM-INF:[^\n]*RESOLUTION=/g)?.length, variants, id);
    assert.match(master, /TYPE=AUDIO/, id);
    assert.equal(/TYPE=SUBTITLES/.test(master), id === "fx-news", id);
  }
});

test("a live playlist is a moving window and its segment is real H.264 video", async () => {
  const media = await text(`${live.url}/live/fx-sports/720p/index.m3u8`);
  assert.equal(media.includes("#EXT-X-ENDLIST"), false, "live: no end");
  const segment = media.split("\n").find((line) => line.trim() && !line.startsWith("#"));
  assert.ok(segment, "the window has a segment");
  const video = await probeSegment(`${live.url}/live/fx-sports/720p/${segment.trim()}`);
  assert.deepEqual([video?.codec_name, video?.width, video?.height], ["h264", 1280, 720]);
});

test("the switch to the next video is a discontinuity in every rendition, and the channel says so", async () => {
  // news-1 is 30 s, 15 segments: move the clock to 34 s in, so the window (numbers 11..16) holds 15, its switch.
  // The channel's start is read off its own playlist: segment `first` is dated start + first * 2 s.
  const now = await text(`${live.url}/live/fx-news/720p/index.m3u8`);
  const first = Number(/#EXT-X-MEDIA-SEQUENCE:(\d+)/.exec(now)[1]);
  const startMs = Date.parse(/#EXT-X-PROGRAM-DATE-TIME:(\S+)/.exec(now)[1]) - first * 2000;
  shift.ms = startMs + 34_000 - Date.now();
  for (const rendition of ["360p", "720p", "audio"]) {
    const media = await text(`${live.url}/live/fx-news/${rendition}/index.m3u8`);
    assert.match(media, /#EXT-X-DISCONTINUITY\n[^\n]+\n[^\n]+\nseg00015\.ts/, rendition);
  }
  const video = await probeSegment(`${live.url}/live/fx-news/720p/seg00015.ts`);
  assert.equal(video?.codec_name, "h264");
  const news = (await listed()).find((channel) => channel.id === "fx-news");
  assert.deepEqual(news.nowPlaying, { index: 1, name: "live/news-2.mp4" });
  shift.ms = 0;
});

test("encode mode joins the playlist's captions, each moved to where its video starts", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-live-inputs-"));
  try {
    const news = loadCatalog()[0];
    const items = (await loadChannelPlaylists([news])).get("fx-news");
    const inputs = await writeEncoderInputs(news, items, dir);
    const list = await readFile(inputs.listPath, "utf-8");
    assert.deepEqual(list.trim().split("\n").map((line) => line.match(/news-\d\.mp4/)[0]), ["news-1.mp4", "news-2.mp4", "news-3.mp4"]);
    const srt = await readFile(inputs.captionsPath, "utf-8");
    // Offsets are the probed lengths, which the audio can stretch by a few milliseconds.
    assert.match(srt, /\n00:00:30,0\d\d --> 00:00:35,0\d\d\nNews programme 2, caption 1\n/);
    assert.match(srt, /\n00:00:50,0\d\d --> 00:00:55,0\d\d\nNews programme 3, caption 1\n/);
    assert.match(srt, /\n00:01:25,0\d\d --> 00:01:30,0\d\d\nNews programme 3, caption 8\n/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("encode mode streams the playlist live through the real encoder", { timeout: 60_000 }, async () => {
  const outDir = mkdtempSync(path.join(os.tmpdir(), "giga-live-encode-"));
  const encoding = await startLiveServer({ mode: "encode", port: 0, outDir, channels: ["fx-news"] });
  try {
    let media = "";
    for (let tries = 0; tries < 40 && !/seg\d{5}\.ts/.test(media); tries += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const response = await fetch(`${encoding.url}/live/fx-news/720p/index.m3u8`);
      media = response.ok ? await response.text() : "";
    }
    const segment = media.split("\n").find((line) => /^seg\d{5}\.ts$/.test(line.trim()));
    assert.ok(segment, "the encoder published a segment");
    const video = await probeSegment(`${encoding.url}/live/fx-news/720p/${segment.trim()}`);
    assert.deepEqual([video?.codec_name, video?.width, video?.height], ["h264", 1280, 720]);
    const [news] = JSON.parse(await (await fetch(`${encoding.url}/channels.json`)).text()).channels;
    assert.deepEqual([news.state, news.nowPlaying?.name], ["live", "live/news-1.mp4"]);
  } finally {
    await encoding.stop();
    rmSync(outDir, { recursive: true, force: true });
  }
});
