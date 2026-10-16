import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";

import { handleControl } from "../control-routes.mjs";
import { createFaultState } from "../fault-state.mjs";
import { createHttpServer } from "../http-server.mjs";
import { FAKE_MASTER, samplePlaylist } from "./fake-source.mjs";

const SEGMENT = Buffer.from("0123456789");

/** An in-memory backend: no ffmpeg, no disk; `files` maps "a/b" to bytes and can change mid-test. */
function fakeBackend(files) {
  return { mode: "loop", state: () => "live", renditions: () => ["360p"], read: async (parts) => files.get(parts.join("/")) ?? null };
}

async function startServer(t, extra = {}) {
  const files = new Map([
    ["master.m3u8", Buffer.from(FAKE_MASTER)],
    ["360p/index.m3u8", Buffer.from(samplePlaylist(10))],
    ["360p/seg00010.ts", SEGMENT],
    ["360p/sub.vtt", Buffer.from("WEBVTT\n")],
  ]);
  const channel = { id: "fx-news", name: "Fixture News", number: 1, category: "News" };
  const channels = new Map([["fx-news", { channel, backend: fakeBackend(files) }]]);
  const sleeps = [];
  const server = createHttpServer({
    mode: "loop",
    channels,
    faults: createFaultState({ now: () => 0 }),
    sleep: async (ms) => void sleeps.push(ms),
    ...extra,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => (server.closeAllConnections(), server.close(resolve))));
  return { files, sleeps, port: server.address().port };
}

function request(port, { method = "GET", path, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path, headers }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end(body);
  });
}
const get = (port, path, headers) => request(port, { path, headers });
const post = (port, path, payload) => request(port, { method: "POST", path, body: typeof payload === "string" ? payload : JSON.stringify(payload) });
const json = (response) => JSON.parse(response.body.toString());

test("healthz and channels.json describe the running channels", async (t) => {
  const { port } = await startServer(t);
  assert.deepEqual(json(await get(port, "/healthz")), { ok: true, mode: "loop", channels: 1 });
  const { channels } = json(await get(port, "/channels.json"));
  assert.deepEqual(channels[0], {
    id: "fx-news", name: "Fixture News", number: 1, category: "News", mode: "loop",
    masterUrl: `http://127.0.0.1:${port}/live/fx-news/master.m3u8`,
    logoUrl: `http://127.0.0.1:${port}/logos/fx-news.png`,
    state: "live", fault: null, renditions: ["360p"],
  });
});

test("playlists are mpegurl and no-store; segments are mp2t and immutable; captions are text/vtt", async (t) => {
  const { port } = await startServer(t);
  for (const path of ["/live/fx-news/master.m3u8", "/live/fx-news/360p/index.m3u8"]) {
    const response = await get(port, path);
    assert.equal(response.status, 200);
    assert.equal(response.headers["content-type"], "application/vnd.apple.mpegurl");
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.body.toString().includes("#EXT-X-ENDLIST"), false);
  }
  const segment = await get(port, "/live/fx-news/360p/seg00010.ts");
  assert.equal(segment.headers["content-type"], "video/mp2t");
  assert.match(segment.headers["cache-control"], /immutable/);
  assert.deepEqual(segment.body, SEGMENT);
  assert.equal((await get(port, "/live/fx-news/360p/sub.vtt")).headers["content-type"], "text/vtt");
});

test("HEAD answers headers without a body", async (t) => {
  const { port } = await startServer(t);
  const response = await request(port, { method: "HEAD", path: "/live/fx-news/360p/seg00010.ts" });
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-length"], "10");
  assert.equal(response.body.length, 0);
});

test("Range gives 206 with the slice, and 416 when it cannot be satisfied", async (t) => {
  const { port } = await startServer(t);
  const path = "/live/fx-news/360p/seg00010.ts";
  const part = await get(port, path, { range: "bytes=2-5" });
  assert.equal(part.status, 206);
  assert.equal(part.headers["content-range"], "bytes 2-5/10");
  assert.equal(part.body.toString(), "2345");
  assert.equal((await get(port, path, { range: "bytes=-3" })).body.toString(), "789");
  assert.equal((await get(port, path, { range: "bytes=5-" })).body.toString(), "56789");
  const outside = await get(port, path, { range: "bytes=20-30" });
  assert.equal(outside.status, 416);
  assert.equal(outside.headers["content-range"], "bytes */10");
  assert.equal((await get(port, path)).headers["accept-ranges"], "bytes");
});

test("unknown channels, files and routes are 404 with a stable error", async (t) => {
  const { port } = await startServer(t);
  assert.equal(json(await get(port, "/live/fx-none/master.m3u8")).error, "channel.not_found");
  const missing = await get(port, "/live/fx-news/360p/seg99999.ts");
  assert.deepEqual([missing.status, json(missing).error], [404, "media.not_found"]);
  assert.deepEqual([(await get(port, "/nope")).status, json(await get(port, "/nope")).error], [404, "route.not_found"]);
  assert.equal((await get(port, "/logos/fx-none.png")).status, 404);
  assert.equal((await request(port, { method: "DELETE", path: "/healthz" })).status, 405);
});

test("path traversal is refused before any lookup", async (t) => {
  const { port } = await startServer(t);
  const hostile = [
    "/live/fx-news/../../etc/passwd",
    "/live/fx-news/360p/%2e%2e/master.m3u8",
    "/live/fx-news/..%2f..%2fsecret",
    "/live/fx-news/360p/..%5cx.ts",
    "/live/fx-news/360p/%00.ts",
    "/live/fx-news/a/b/c.ts",
  ];
  for (const path of hostile) assert.equal((await get(port, path)).status, 400, path);
});

test("the logo is a valid PNG; CORS echoes loopback origins only", async (t) => {
  const { port } = await startServer(t);
  const logo = await get(port, "/logos/fx-news.png");
  assert.equal(logo.headers["content-type"], "image/png");
  assert.deepEqual([...logo.body.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const local = await get(port, "/healthz", { origin: "http://localhost:5171" });
  assert.equal(local.headers["access-control-allow-origin"], "http://localhost:5171");
  const foreign = await get(port, "/healthz", { origin: "http://evil.example" });
  assert.equal(foreign.headers["access-control-allow-origin"], undefined);
  const preflight = await request(port, { method: "OPTIONS", path: "/live/fx-news/master.m3u8", headers: { origin: "http://127.0.0.1:5171" } });
  assert.equal(preflight.status, 204);
});

test("the test page exists only when the server was given one", async (t) => {
  const absent = await startServer(t);
  assert.equal((await get(absent.port, "/test/player.html")).status, 404);
  const present = await startServer(t, { testPage: "<!doctype html><video></video>" });
  const page = await get(present.port, "/test/player.html");
  assert.equal(page.status, 200);
  assert.match(page.headers["content-type"], /text\/html/);
});

test("control routes refuse non-loopback peers and wrong methods", async (t) => {
  const sent = [];
  const res = { writeHead: (status) => sent.push(status), end() {} };
  const stranger = { method: "POST", headers: {}, socket: { remoteAddress: "192.168.1.20" } };
  const args = { channelId: "fx-news", action: "fault", channels: new Map(), faults: createFaultState() };
  await handleControl(stranger, res, args);
  assert.deepEqual(sent, [403]);
  const { port } = await startServer(t);
  assert.equal((await get(port, "/control/fx-news/clear")).status, 405);
  assert.equal((await post(port, "/control/fx-none/clear", {})).status, 404);
});

test("faults change responses and clear restores them", async (t) => {
  const { port, files, sleeps } = await startServer(t);
  const playlist = "/live/fx-news/360p/index.m3u8";
  const segment = "/live/fx-news/360p/seg00010.ts";

  assert.equal((await post(port, "/control/fx-news/fault", { fault: "playlist-500" })).status, 200);
  assert.equal(json(await get(port, "/channels.json")).channels[0].fault, "playlist-500");
  assert.equal((await get(port, playlist)).status, 500);
  assert.equal((await get(port, "/live/fx-news/master.m3u8")).status, 200);
  await post(port, "/control/fx-news/clear", {});
  assert.equal((await get(port, playlist)).status, 200);

  await post(port, "/control/fx-news/fault", { fault: "segment-404" });
  assert.equal((await get(port, segment)).status, 404);
  await post(port, "/control/fx-news/fault", { fault: "end" });
  assert.match((await get(port, playlist)).body.toString(), /#EXT-X-ENDLIST/);
  assert.equal((await get(port, segment)).status, 200);

  await post(port, "/control/fx-news/fault", { fault: "slow-segments", delayMs: 1500 });
  assert.equal((await get(port, segment)).status, 200);
  assert.deepEqual(sleeps, [1500]);

  await post(port, "/control/fx-news/fault", { fault: "stall" });
  const held = (await get(port, playlist)).body.toString();
  files.set("360p/index.m3u8", Buffer.from(samplePlaylist(14)));
  assert.equal((await get(port, playlist)).body.toString(), held);
  await post(port, "/control/fx-news/clear", {});
  assert.match((await get(port, playlist)).body.toString(), /#EXT-X-MEDIA-SEQUENCE:14/);
});

test("restart and discontinuity faults rewrite the sequence over HTTP", async (t) => {
  const { port } = await startServer(t);
  const playlist = "/live/fx-news/360p/index.m3u8";
  await post(port, "/control/fx-news/fault", { fault: "restart" });
  assert.match((await get(port, playlist)).body.toString(), /#EXT-X-MEDIA-SEQUENCE:0\n/);
  await post(port, "/control/fx-news/fault", { fault: "discontinuity" });
  assert.match((await get(port, playlist)).body.toString(), /#EXT-X-MEDIA-SEQUENCE:1010\n/);
});

test("control rejects unknown faults and bad JSON with 400", async (t) => {
  const { port } = await startServer(t);
  const unknown = await post(port, "/control/fx-news/fault", { fault: "explode" });
  assert.deepEqual([unknown.status, json(unknown).error], [400, "fault.invalid"]);
  const broken = await post(port, "/control/fx-news/fault", "{nope");
  assert.deepEqual([broken.status, json(broken).error], [400, "body.invalid_json"]);
  const timed = await post(port, "/control/fx-news/fault", { fault: "stall", durationMs: 60000 });
  assert.equal(json(timed).fault.expiresInMs, 60000);
});
