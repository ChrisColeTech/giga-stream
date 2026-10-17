// Opt-in (LIVE_ENGINE_TESTS=1): the live engine over the real fixture videos, ffprobe and ffmpeg (docs/10 section 5).
// The first run encodes the fixtures (a minute or two); later runs reuse the cache in the temp folder.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { before } from "node:test";

import { ENGINE_TESTS, filesUnder, fixture, fixtures, probeVideo, realApp, SKIP_REASON } from "./live-engine-kit.js";
import { itemOf } from "./live-channel-kit.js";
import { pick, request, send, signIn } from "./test-app.js";

const skip = ENGINE_TESTS ? false : SKIP_REASON;
let dir = "";
before(async () => {
  if (ENGINE_TESTS) dir = await fixtures();
});

const channel = (overrides: Record<string, unknown> = {}) => ({
  kind: "live", id: "home", name: "Home Videos", category: "Entertainment", number: 7,
  videos: [fixture(dir, "kids", 1), fixture(dir, "music", 1)], ...overrides,
});
const admin = async (t: Awaited<ReturnType<typeof realApp>>, token: string) =>
  (await send(t.app, "GET", "/api/admin-channels", undefined, token)).body;

test("the seed makes the four test channels live from the real fixtures, with captions on news", { skip, timeout: 600_000 }, async () => {
  const t = await realApp({ seed: true });
  await t.live.settled();
  const token = (await signIn(t.app)).access;
  const body = await admin(t, token);
  for (const [id, variants] of [["fx-news", 2], ["fx-sports", 3], ["fx-music", 2], ["fx-kids", 2]] as const) {
    assert.deepEqual([itemOf(body, id).state, (itemOf(body, id).playlist as unknown[]).length], ["live", 3], id);
    const master = (await send(t.app, "GET", `/live/${id}/master.m3u8`)).raw.toString();
    assert.equal(master.match(/#EXT-X-STREAM-INF:[^\n]*RESOLUTION=/g)?.length, variants, id);
    assert.equal(/TYPE=SUBTITLES/.test(master), id === "fx-news", id);
  }
});

test("a segment is real H.264, immutable, with Range and HEAD; the switch is a discontinuity in every rendition", { skip, timeout: 600_000 }, async () => {
  const t = await realApp({ seed: true });
  await t.live.settled();
  const media = (await send(t.app, "GET", "/live/fx-sports/720p/index.m3u8")).raw.toString();
  const name = media.split("\n").find((line) => /^seg\d{5}\.ts$/.test(line)) ?? "";
  const segment = await send(t.app, "GET", `/live/fx-sports/720p/${name}`);
  assert.deepEqual([segment.headers["content-type"], segment.headers["accept-ranges"]], ["video/mp2t", "bytes"]);
  const video = await probeVideo(segment.raw);
  assert.deepEqual([pick(video, "codec_name"), pick(video, "width"), pick(video, "height")], ["h264", 1280, 720]);
  const part = await request(t.app, { method: "GET", url: `/live/fx-sports/720p/${name}`, headers: { range: "bytes=2-5" } });
  assert.deepEqual([part.status, part.headers["content-range"], part.raw.length], [206, `bytes 2-5/${segment.raw.length}`, 4]);
  assert.equal((await send(t.app, "HEAD", `/live/fx-sports/720p/${name}`)).raw.length, 0);
  // news-1 is 30 s, 15 segments: put the clock 34 s in, so the window (numbers 11..16) holds the switch at 15.
  t.clock.advance(22_000);
  for (const rendition of ["360p", "720p", "audio"]) {
    const text = (await send(t.app, "GET", `/live/fx-news/${rendition}/index.m3u8`)).raw.toString();
    assert.match(text, /#EXT-X-DISCONTINUITY\n[^\n]+\n[^\n]+\nseg00015\.ts/, rendition);
  }
  assert.equal(pick(await probeVideo((await send(t.app, "GET", "/live/fx-news/720p/seg00015.ts")).raw), "codec_name"), "h264");
  const token = (await signIn(t.app)).access;
  assert.deepEqual(itemOf(await admin(t, token), "fx-news").nowPlaying, { index: 1, name: "news-2.mp4" });
});

test("a folder channel plays every video in the folder, in path order", { skip, timeout: 600_000 }, async () => {
  const t = await realApp();
  const token = (await signIn(t.app)).access;
  await send(t.app, "POST", "/api/channels", channel({ videos: undefined, folder: path.join(dir, "live") }), token);
  await t.live.settled();
  const playlist = itemOf(await admin(t, token), "home").playlist as Array<Record<string, unknown>>;
  assert.equal(playlist.length, 12);
  assert.deepEqual(playlist.map((entry) => entry.name).slice(0, 4), ["kids-1.mp4", "kids-2.mp4", "kids-3.mp4", "music-1.mp4"]);
});

test("a video that cannot be played, or a folder with none, leaves that channel failed and the rest live", { skip, timeout: 600_000 }, async () => {
  const t = await realApp();
  const token = (await signIn(t.app)).access;
  const scratch = mkdtempSync(path.join(os.tmpdir(), "giga-live-broken-"));
  try {
    const broken = path.join(scratch, "broken.mp4");
    writeFileSync(broken, "not a video");
    await send(t.app, "POST", "/api/channels", channel(), token);
    await send(t.app, "POST", "/api/channels", channel({ id: "bad", number: 8, videos: [fixture(dir, "kids", 1), broken] }), token);
    await send(t.app, "POST", "/api/channels", channel({ id: "empty", number: 9, videos: undefined, folder: scratch }), token);
    await t.live.settled();
    const body = await admin(t, token);
    assert.deepEqual(["home", "bad", "empty"].map((id) => itemOf(body, id).state), ["live", "failed", "failed"]);
    assert.match(String(itemOf(body, "bad").problem), /broken\.mp4 cannot be played/);
    assert.match(String(itemOf(body, "empty").problem), /no playable video/);
    assert.equal((await send(t.app, "GET", "/healthz")).status, 200);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("encode mode streams a playlist live through the real encoder and leaves no output when the backend closes", { skip, timeout: 120_000 }, async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-encode-"));
  try {
    const t = await realApp({ dataDir });
    const token = (await signIn(t.app)).access;
    const body = { id: "enc", name: "Encode", category: "News", number: 1, mode: "encode", captions: true,
      videos: [fixture(dir, "news", 1), fixture(dir, "news", 2)] };
    assert.equal((await send(t.app, "POST", "/api/channels", body, token)).status, 201);
    await t.live.settled();
    let media = "";
    for (let tries = 0; tries < 40 && !/seg\d{5}\.ts/.test(media); tries += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const answer = await send(t.app, "GET", "/live/enc/720p/index.m3u8");
      media = answer.status === 200 ? answer.raw.toString() : "";
    }
    const name = media.split("\n").find((line) => /^seg\d{5}\.ts$/.test(line));
    assert.ok(name, "the encoder published a segment");
    const video = await probeVideo((await send(t.app, "GET", `/live/enc/720p/${name}`)).raw);
    assert.deepEqual([pick(video, "codec_name"), pick(video, "height")], ["h264", 720]);
    const enc = itemOf(await admin(t, token), "enc");
    assert.deepEqual([enc.state, pick(enc, "nowPlaying.name")], ["live", "news-1.mp4"]);
    assert.match((await send(t.app, "GET", "/live/enc/master.m3u8")).raw.toString(), /SUBTITLES/);
    assert.ok(filesUnder(path.join(dataDir, "encode")).length > 0, "the encoder is writing its window");
    await t.dispose();
    assert.deepEqual(filesUnder(path.join(dataDir, "encode")), [], "no encode-mode output after the backend closes");
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
