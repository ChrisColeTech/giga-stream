// The stream routes over the four seeded test channels, from the real fixture files: playlists, segments
// (checked with ffprobe), Range, CORS, faults, the switch between videos, and encode mode's live encoder.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { before, test } from "node:test";

import { locateTool } from "../../shared/media/src/ffmpeg/locate-tool.ts";
import { runTool } from "../../shared/media/src/ffmpeg/run-tool.ts";
import type { LiveServer } from "../src/app.ts";
import { fixture, fixtures, makeServer, pick, send } from "./test-app.ts";

// The channels' clock runs `shift` ahead of the wall, so a test can move a channel to just before a switch.
const shift = { ms: 0 };
const sleeps: number[] = [];
let server: LiveServer;
before(async () => {
  server = await makeServer({
    seed: true,
    now: () => Date.now() + shift.ms,
    sleep: async (ms) => void sleeps.push(ms),
    config: { TEST_PAGE: true },
  });
  await server.services.settled();
});

const text = async (url: string) => {
  const answer = await send(server, "GET", url);
  assert.equal(answer.status, 200, url);
  return answer.raw.toString();
};

/** ffprobe's video stream of bytes the server served. */
async function probeVideo(bytes: Buffer) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-live-segment-"));
  try {
    writeFileSync(path.join(dir, "segment.ts"), bytes);
    const args = ["-v", "error", "-show_streams", "-of", "json", path.join(dir, "segment.ts")];
    const { stdout } = await runTool(locateTool("ffprobe"), args, { captureStdout: true });
    const streams = pick(JSON.parse(stdout), "streams");
    return Array.isArray(streams) ? streams.find((stream) => pick(stream, "codec_type") === "video") : undefined;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the seed makes the four test channels, live, with their playlists and captions on news", async () => {
  const channels = pick((await send(server, "GET", "/api/channels")).body, "data");
  assert.ok(Array.isArray(channels));
  assert.deepEqual(channels.map((c) => [pick(c, "id"), pick(c, "state"), pick(c, "playlist.length")]), [
    ["fx-news", "live", 3], ["fx-sports", "live", 3], ["fx-music", "live", 3], ["fx-kids", "live", 3],
  ]);
  for (const [id, variants] of [["fx-news", 2], ["fx-sports", 3], ["fx-music", 2], ["fx-kids", 2]] as const) {
    const master = await text(`/live/${id}/master.m3u8`);
    assert.equal(master.match(/#EXT-X-STREAM-INF:[^\n]*RESOLUTION=/g)?.length, variants, id);
    assert.equal(/TYPE=SUBTITLES/.test(master), id === "fx-news", id);
  }
});

test("playlists are live and no-store; a segment is real H.264, immutable, with Range and HEAD", async () => {
  const media = await send(server, "GET", "/live/fx-sports/720p/index.m3u8");
  assert.deepEqual([media.headers["content-type"], media.headers["cache-control"]], ["application/vnd.apple.mpegurl", "no-store"]);
  assert.equal(media.raw.toString().includes("#EXT-X-ENDLIST"), false);
  const name = media.raw.toString().split("\n").find((line) => /^seg\d{5}\.ts$/.test(line)) ?? "";
  const segment = await send(server, "GET", `/live/fx-sports/720p/${name}`);
  assert.deepEqual([segment.headers["content-type"], segment.headers["accept-ranges"]], ["video/mp2t", "bytes"]);
  assert.match(String(segment.headers["cache-control"]), /immutable/);
  const video = await probeVideo(segment.raw);
  assert.deepEqual([pick(video, "codec_name"), pick(video, "width"), pick(video, "height")], ["h264", 1280, 720]);
  const part = await send(server, "GET", `/live/fx-sports/720p/${name}`, { headers: { range: "bytes=2-5" } });
  assert.deepEqual([part.status, part.headers["content-range"], part.raw.length], [206, `bytes 2-5/${segment.raw.length}`, 4]);
  const outside = await send(server, "GET", `/live/fx-sports/720p/${name}`, { headers: { range: "bytes=99999999-" } });
  assert.deepEqual([outside.status, pick(outside.body, "error.code")], [416, "range.unsatisfiable"]);
  const head = await send(server, "HEAD", `/live/fx-sports/720p/${name}`);
  assert.deepEqual([head.status, head.raw.length], [200, 0]);
});

test("the switch to the next video is a discontinuity in every rendition, and the channel says so", async () => {
  // news-1 is 30 s, 15 segments: move the clock to 34 s in, so the window (numbers 11..16) holds 15.
  const now = await text("/live/fx-news/720p/index.m3u8");
  const first = Number(/#EXT-X-MEDIA-SEQUENCE:(\d+)/.exec(now)?.[1]);
  const startMs = Date.parse(/#EXT-X-PROGRAM-DATE-TIME:(\S+)/.exec(now)?.[1] ?? "") - first * 2000;
  shift.ms = startMs + 34_000 - Date.now();
  try {
    for (const rendition of ["360p", "720p", "audio"]) {
      assert.match(await text(`/live/fx-news/${rendition}/index.m3u8`), /#EXT-X-DISCONTINUITY\n[^\n]+\n[^\n]+\nseg00015\.ts/, rendition);
    }
    assert.equal(pick(await probeVideo((await send(server, "GET", "/live/fx-news/720p/seg00015.ts")).raw), "codec_name"), "h264");
    const news = (await send(server, "GET", "/api/channels/fx-news")).body;
    assert.deepEqual(pick(news, "data.nowPlaying"), { index: 1, name: "news-2.mp4" });
  } finally {
    shift.ms = 0;
  }
});

test("bad stream addresses are refused before any lookup, in the envelope", async () => {
  // Over a real socket: the injector would normalise these paths before the server saw them.
  await server.app.listen({ port: 0, host: "127.0.0.1" });
  const address = server.app.server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  const raw = (url: string) => new Promise<number>((resolve, reject) => {
    http.get({ host: "127.0.0.1", port, path: url }, (res) => resolve(res.resume().statusCode ?? 0)).on("error", reject);
  });
  for (const url of ["/live/fx-news/360p/%2e%2e/master.m3u8", "/live/fx-news/..%2f..%2fsecret", "/live/fx-news/a/b/c.ts",
    "/live/fx-news/../../etc/passwd", "/live/fx-news/360p/..%5cx.ts"]) {
    assert.ok([400, 404].includes(await raw(url)), url);
  }
  assert.equal(await raw("/live/fx-news/360p/%2e%2e/master.m3u8"), 400);
  const missing = await send(server, "GET", "/live/fx-none/master.m3u8");
  assert.deepEqual([missing.status, pick(missing.body, "error.code")], [404, "channel.not_found"]);
  assert.equal(pick((await send(server, "GET", "/live/fx-news/360p/seg99999.ts")).body, "error.code"), "media.not_found");
  assert.equal(pick((await send(server, "GET", "/nope")).body, "error.code"), "route.not_found");
});

test("logos are PNGs; CORS answers loopback origins only; the test page is there when asked for", async () => {
  const logo = await send(server, "GET", "/logos/fx-news.png");
  assert.deepEqual([logo.headers["content-type"], [...logo.raw.subarray(1, 4)]], ["image/png", [0x50, 0x4e, 0x47]]);
  assert.equal((await send(server, "GET", "/logos/fx-none.png")).status, 404);
  const local = await send(server, "GET", "/healthz", { headers: { origin: "http://localhost:5171" } });
  assert.equal(local.headers["access-control-allow-origin"], "http://localhost:5171");
  const foreign = await send(server, "GET", "/healthz", { headers: { origin: "http://evil.example" } });
  assert.equal(foreign.headers["access-control-allow-origin"], undefined);
  assert.match(String((await send(server, "GET", "/test/player.html")).headers["content-type"]), /text\/html/);
});

test("faults change what a player gets, and clearing restores it", async () => {
  const playlist = "/live/fx-kids/360p/index.m3u8";
  const fault = (body: unknown) => send(server, "PUT", "/api/channels/fx-kids/fault", { body });
  assert.equal(pick((await fault({ fault: "playlist-500" })).body, "data.fault.fault"), "playlist-500");
  assert.equal(pick((await send(server, "GET", "/api/channels/fx-kids")).body, "data.fault"), "playlist-500");
  assert.equal((await send(server, "GET", playlist)).status, 500);
  assert.equal((await send(server, "GET", "/live/fx-kids/master.m3u8")).status, 200);
  await fault({ fault: "end" });
  assert.match((await send(server, "GET", playlist)).raw.toString(), /#EXT-X-ENDLIST/);
  await fault({ fault: "slow-segments", delayMs: 1500 });
  const name = (await send(server, "GET", playlist)).raw.toString().split("\n").find((line) => line.startsWith("seg"));
  assert.equal((await send(server, "GET", `/live/fx-kids/360p/${name}`)).status, 200);
  assert.deepEqual(sleeps, [1500]);
  await fault({ fault: "segment-404" });
  assert.equal((await send(server, "GET", `/live/fx-kids/360p/${name}`)).status, 404);
  await send(server, "DELETE", "/api/channels/fx-kids/fault");
  assert.equal((await send(server, "GET", playlist)).status, 200);
  assert.equal(pick((await fault({ fault: "explode" })).body, "error.code"), "fault.invalid");
  assert.equal((await send(server, "PUT", "/api/channels/fx-none/fault", { body: { fault: "end" } })).status, 404);
  assert.equal((await send(server, "PUT", "/api/channels/fx-kids/fault", { body: { fault: "end" }, address: "10.0.0.2" })).status, 403);
});

test("encode mode streams a playlist live through the real encoder", { timeout: 60_000 }, async () => {
  const encoding = await makeServer();
  const dir = await fixtures();
  const body = { id: "enc", name: "Encode", category: "News", number: 1, mode: "encode", captions: true,
    videos: [fixture(dir, "news", 1), fixture(dir, "news", 2)] };
  assert.equal((await send(encoding, "POST", "/api/channels", { body })).status, 201);
  await encoding.services.settled();
  let media = "";
  for (let tries = 0; tries < 40 && !/seg\d{5}\.ts/.test(media); tries += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const answer = await send(encoding, "GET", "/live/enc/720p/index.m3u8");
    media = answer.status === 200 ? answer.raw.toString() : "";
  }
  const name = media.split("\n").find((line) => /^seg\d{5}\.ts$/.test(line));
  assert.ok(name, "the encoder published a segment");
  const video = await probeVideo((await send(encoding, "GET", `/live/enc/720p/${name}`)).raw);
  assert.deepEqual([pick(video, "codec_name"), pick(video, "height")], ["h264", 720]);
  const read = (await send(encoding, "GET", "/api/channels/enc")).body;
  assert.deepEqual([pick(read, "data.state"), pick(read, "data.nowPlaying.name")], ["live", "news-1.mp4"]);
  assert.match(await (async () => (await send(encoding, "GET", "/live/enc/master.m3u8")).raw.toString())(), /SUBTITLES/);
});
