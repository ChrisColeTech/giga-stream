// The stream routes at root (docs/10 section 3.1, `01` section 4.3): bytes, not the envelope, from a fake source.
import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import { parseRange } from "../src/api/byte-range.js";
import { liveBody } from "./live-channel-kit.js";
import { makeApp, pick, send, signIn } from "./test-app.js";

async function withChannel() {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  await send(t.app, "POST", "/api/channels", liveBody(), token);
  await t.live.settled();
  return { t, token };
}

test("the master lists every level and the audio group; renditions are live playlists that are never cached", async () => {
  const { t } = await withChannel();
  const master = await send(t.app, "GET", "/live/home/master.m3u8");
  assert.deepEqual([master.status, master.headers["content-type"], master.headers["cache-control"]], [200, "application/vnd.apple.mpegurl", "no-store"]);
  assert.match(master.raw.toString(), /RESOLUTION=1280x720/);
  assert.match(master.raw.toString(), /\n360p\/index\.m3u8\n/);
  for (const rendition of ["360p", "720p", "audio"]) {
    const media = await send(t.app, "GET", `/live/home/${rendition}/index.m3u8`);
    assert.deepEqual([media.status, media.headers["content-type"], media.headers["cache-control"]], [200, "application/vnd.apple.mpegurl", "no-store"]);
    assert.equal(media.raw.toString().includes("#EXT-X-ENDLIST"), false);
    assert.equal(media.raw.toString().match(/^seg\d{5}\.ts$/gm)?.length, 6);
  }
  const head = await send(t.app, "HEAD", "/live/home/720p/index.m3u8");
  assert.deepEqual([head.status, head.raw.length, head.headers["cache-control"]], [200, 0, "no-store"]);
});

test("a segment is video/mp2t and immutable; Range answers 206 or 416 and HEAD answers no body", async () => {
  const { t } = await withChannel();
  const segment = await send(t.app, "GET", "/live/home/720p/seg00000.ts");
  assert.deepEqual([segment.status, segment.headers["content-type"], segment.headers["accept-ranges"]], [200, "video/mp2t", "bytes"]);
  assert.match(String(segment.headers["cache-control"]), /immutable/);
  assert.equal(segment.raw.toString(), "720p:0");
  const range = (header: string) =>
    t.app.inject({ method: "GET", url: "/live/home/720p/seg00000.ts", headers: { range: header } });
  const part = await range("bytes=2-5");
  assert.deepEqual([part.statusCode, part.headers["content-range"], part.rawPayload.toString()], [206, "bytes 2-5/6", "0p:0"]);
  const tail = await range("bytes=-3");
  assert.deepEqual([tail.statusCode, tail.headers["content-range"], tail.rawPayload.toString()], [206, "bytes 3-5/6", "p:0"]);
  const outside = await range("bytes=99999999-");
  assert.deepEqual([outside.statusCode, outside.headers["content-range"], pick(JSON.parse(outside.body), "error.code")], [416, "bytes */6", "range.unsatisfiable"]);
  const head = await send(t.app, "HEAD", "/live/home/720p/seg00000.ts");
  assert.deepEqual([head.status, head.raw.length], [200, 0]);
  assert.equal((await send(t.app, "HEAD", "/live/home/master.m3u8")).status, 200);
});

test("byte ranges parse the way the live server parsed them", () => {
  assert.deepEqual(parseRange("bytes=2-5", 10), { start: 2, end: 5 });
  assert.deepEqual(parseRange("bytes=4-", 10), { start: 4, end: 9 });
  assert.deepEqual(parseRange("bytes=0-99", 10), { start: 0, end: 9 });
  assert.deepEqual(parseRange("bytes=-3", 10), { start: 7, end: 9 });
  assert.equal(parseRange("bytes=10-", 10), "unsatisfiable");
  assert.equal(parseRange("bytes=5-2", 10), "unsatisfiable");
  assert.equal(parseRange("bytes=-0", 10), "unsatisfiable");
  for (const header of [undefined, "", "items=1-2", "bytes=-", "bytes=a-b"]) assert.equal(parseRange(header, 10), null);
});

test("the switch to the next video is a discontinuity in every rendition, and the channel says so", async () => {
  const { t, token } = await withChannel();
  const nowPlaying = async () => {
    const items = pick((await send(t.app, "GET", "/api/admin-channels", undefined, token)).body, "data.items");
    return pick(Array.isArray(items) ? items[0] : undefined, "nowPlaying.name");
  };
  assert.equal(await nowPlaying(), "a.mp4");
  t.clock.advance(6000); // a is 3 segments (6 s): the window is now 3..8 and b begins at 3
  for (const rendition of ["360p", "720p", "audio"]) {
    const media = (await send(t.app, "GET", `/live/home/${rendition}/index.m3u8`)).raw.toString();
    assert.match(media, /#EXT-X-DISCONTINUITY\n[^\n]+\n[^\n]+\nseg00003\.ts/, rendition);
  }
  assert.equal(await nowPlaying(), "b.mp4");
  assert.equal((await send(t.app, "GET", "/live/home/720p/seg00008.ts")).raw.toString(), "720p:0");
});

test("bad stream addresses are refused before any lookup, in the envelope", async () => {
  const { t } = await withChannel();
  // Over a real socket: the injector would normalise these paths before the server saw them.
  await t.app.listen({ port: 0, host: "127.0.0.1" });
  const address = t.app.server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  const raw = (url: string) =>
    new Promise<number>((resolve, reject) => {
      http.get({ host: "127.0.0.1", port, path: url }, (res) => resolve(res.resume().statusCode ?? 0)).on("error", reject);
    });
  for (const url of ["/live/home/360p/%2e%2e/master.m3u8", "/live/home/..%2f..%2fsecret", "/live/home/a/b/c.ts",
    "/live/home/../../etc/passwd", "/live/home/360p/..%5cx.ts"]) {
    assert.ok([400, 404].includes(await raw(url)), url);
  }
  assert.equal(await raw("/live/home/360p/%2e%2e/master.m3u8"), 400);
  assert.equal(pick((await send(t.app, "GET", "/live/Home/master.m3u8")).body, "error.code"), "path.invalid");
  const missing = await send(t.app, "GET", "/live/nope/master.m3u8");
  assert.deepEqual([missing.status, pick(missing.body, "error.code")], [404, "channel.not_found"]);
  assert.equal(pick((await send(t.app, "GET", "/live/home/360p/seg99999.ts")).body, "error.code"), "media.not_found");
  assert.equal(pick((await send(t.app, "GET", "/live/home/1080p/index.m3u8")).body, "error.code"), "media.not_found");
  assert.equal(pick((await send(t.app, "GET", "/nope")).body, "error.code"), "route.not_found");
});

test("logos are generated PNGs for live channels only", async () => {
  const { t } = await withChannel();
  const logo = await send(t.app, "GET", "/logos/home.png");
  assert.deepEqual([logo.status, logo.headers["content-type"], [...logo.raw.subarray(1, 4)]], [200, "image/png", [0x50, 0x4e, 0x47]]);
  assert.match(String(logo.headers["cache-control"]), /immutable/);
  assert.equal(pick((await send(t.app, "GET", "/logos/nope.png")).body, "error.code"), "channel.not_found");
  assert.equal(pick((await send(t.app, "GET", "/logos/home.jpg")).body, "error.code"), "path.invalid");
});
