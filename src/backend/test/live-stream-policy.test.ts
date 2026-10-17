// What sits around the stream bytes: the two CORS policies that must not collide, the test page, and faults.
import assert from "node:assert/strict";
import test from "node:test";

import { itemOf, liveBody } from "./live-channel-kit.js";
import { type MakeAppOptions, makeApp, pick, request, send, signIn } from "./test-app.js";

const LISTED = "https://admin.example.test";
const LOOPBACK = "http://localhost:5171";

async function withChannel(options: MakeAppOptions = {}) {
  const t = await makeApp(options);
  const token = (await signIn(t.app)).access;
  await send(t.app, "POST", "/api/channels", liveBody(), token);
  await t.live.settled();
  return { t, token };
}

const header = (answer: { headers: Record<string, unknown> }, name: string) => String(answer.headers[name] ?? "");
const get = (t: Awaited<ReturnType<typeof makeApp>>, url: string, origin?: string) =>
  request(t.app, { method: "GET", url, ...(origin !== undefined && { headers: { origin } }) });

test("the stream routes answer loopback origins and CORS_ORIGINS, read-only, and expose what a player reads", async () => {
  const { t } = await withChannel({ config: { CORS_ORIGINS: LISTED } });
  for (const url of ["/live/home/master.m3u8", "/live/home/720p/seg00000.ts", "/logos/home.png"]) {
    assert.equal((await get(t, url, LOOPBACK)).headers["access-control-allow-origin"], LOOPBACK, url);
    assert.equal((await get(t, url, "http://127.0.0.1:8090")).headers["access-control-allow-origin"], "http://127.0.0.1:8090", url);
    assert.equal((await get(t, url, LISTED)).headers["access-control-allow-origin"], LISTED, url);
    assert.equal((await get(t, url, "http://evil.example")).headers["access-control-allow-origin"], undefined, url);
  }
  const exposed = header(await get(t, "/live/home/720p/seg00000.ts", LOOPBACK), "access-control-expose-headers");
  for (const name of ["content-length", "content-range", "accept-ranges"]) assert.ok(exposed.includes(name), name);
  const preflight = await request(t.app, {
    method: "OPTIONS",
    url: "/live/home/720p/seg00000.ts",
    headers: { origin: LOOPBACK, "access-control-request-method": "GET", "access-control-request-headers": "range" },
  });
  assert.equal(preflight.status, 204);
  assert.equal(header(preflight, "access-control-allow-origin"), LOOPBACK);
  assert.ok(header(preflight, "access-control-allow-headers").includes("range"));
  const methods = header(preflight, "access-control-allow-methods");
  assert.deepEqual(["GET", "HEAD"].map((m) => methods.includes(m)), [true, true]);
  assert.deepEqual(["POST", "PUT", "PATCH", "DELETE"].map((m) => methods.includes(m)), [false, false, false, false]);
});

test("/api keeps its own policy: no loopback allowance, the listed origins only, and PUT for the faults", async () => {
  const { t } = await withChannel({ config: { CORS_ORIGINS: LISTED } });
  assert.equal((await get(t, "/api/channels", LOOPBACK)).headers["access-control-allow-origin"], undefined);
  assert.equal((await get(t, "/api/channels", LISTED)).headers["access-control-allow-origin"], LISTED);
  const preflight = await request(t.app, {
    method: "OPTIONS",
    url: "/api/channels/home/fault",
    headers: { origin: LISTED, "access-control-request-method": "PUT", "access-control-request-headers": "authorization,content-type" },
  });
  assert.equal(preflight.status, 204);
  const methods = header(preflight, "access-control-allow-methods");
  assert.deepEqual(["GET", "POST", "PATCH", "PUT", "DELETE"].map((m) => methods.includes(m)), [true, true, true, true, true]);
  assert.equal(methods.includes("HEAD"), false);
  const loopbackPreflight = await request(t.app, {
    method: "OPTIONS",
    url: "/api/channels",
    headers: { origin: LOOPBACK, "access-control-request-method": "GET" },
  });
  assert.equal(loopbackPreflight.headers["access-control-allow-origin"], undefined);
});

test("with no CORS_ORIGINS the API is closed to browsers while the streams still serve loopback pages", async () => {
  const { t } = await withChannel();
  assert.equal((await get(t, "/api/channels", LISTED)).headers["access-control-allow-origin"], undefined);
  assert.equal((await get(t, "/live/home/master.m3u8", LISTED)).headers["access-control-allow-origin"], undefined);
  assert.equal((await get(t, "/live/home/master.m3u8", LOOPBACK)).headers["access-control-allow-origin"], LOOPBACK);
});

test("the test player page is served only with TEST_PAGE=true", async () => {
  const off = await makeApp();
  const missing = await send(off.app, "GET", "/test/player.html");
  assert.deepEqual([missing.status, pick(missing.body, "error.code")], [404, "route.not_found"]);
  const on = await makeApp({ config: { TEST_PAGE: true } });
  const page = await send(on.app, "GET", "/test/player.html?channel=home");
  assert.deepEqual([page.status, page.headers["cache-control"]], [200, "no-store"]);
  assert.match(String(page.headers["content-type"]), /text\/html/);
  assert.match(page.raw.toString(), /hls\.js@1\.5\.20/);
  assert.match(page.raw.toString(), /window\.snapshot/);
});

test("faults change what a player gets, and clearing restores it", async () => {
  const { t, token } = await withChannel();
  const playlist = "/live/home/360p/index.m3u8";
  const fault = (body: unknown) => send(t.app, "PUT", "/api/channels/home/fault", body, token);
  const status = async (url: string) => (await send(t.app, "GET", url)).status;
  assert.equal(pick((await fault({ fault: "playlist-500" })).body, "data.fault.fault"), "playlist-500");
  const admin = await send(t.app, "GET", "/api/admin-channels", undefined, token);
  assert.equal(itemOf(admin.body, "home").fault, "playlist-500");
  const broken = await send(t.app, "GET", playlist);
  assert.deepEqual([broken.status, pick(broken.body, "error.code")], [500, "playlist.unavailable"]);
  assert.equal(await status("/live/home/master.m3u8"), 200);
  await fault({ fault: "end" });
  assert.match((await send(t.app, "GET", playlist)).raw.toString(), /#EXT-X-ENDLIST/);
  await fault({ fault: "slow-segments", delayMs: 1500 });
  assert.equal(await status("/live/home/360p/seg00000.ts"), 200);
  assert.deepEqual(t.sleeps, [1500]);
  await fault({ fault: "segment-404" });
  const gone = await send(t.app, "GET", "/live/home/360p/seg00000.ts");
  assert.deepEqual([gone.status, pick(gone.body, "error.code")], [404, "media.not_found"]);
  assert.deepEqual((await send(t.app, "DELETE", "/api/channels/home/fault", undefined, token)).body, { ok: true, data: { id: "home", fault: null } });
  assert.equal(await status(playlist), 200);
  assert.equal(itemOf((await send(t.app, "GET", "/api/admin-channels", undefined, token)).body, "home").fault, null);
});

test("a fault with a duration clears itself on the clock; a bad fault, an unknown channel and a stream row are refused", async () => {
  const { t, token } = await withChannel();
  await send(t.app, "PUT", "/api/channels/home/fault", { fault: "segment-404", durationMs: 5000 }, token);
  assert.equal((await send(t.app, "GET", "/live/home/360p/seg00000.ts")).status, 404);
  t.clock.advance(5000);
  assert.equal((await send(t.app, "GET", "/live/home/360p/seg00000.ts")).status, 200);
  const refusal = async (url: string, body: unknown) => {
    const answer = await send(t.app, "PUT", url, body, token);
    return [answer.status, pick(answer.body, "error.code")];
  };
  assert.deepEqual(await refusal("/api/channels/home/fault", { fault: "explode" }), [400, "fault.invalid"]);
  assert.deepEqual(await refusal("/api/channels/home/fault", { fault: "stall", durationMs: -1 }), [400, "fault.invalid"]);
  assert.deepEqual(await refusal("/api/channels/home/fault", { fault: "stall", colour: "red" }), [400, "fault.invalid"]);
  assert.deepEqual(await refusal("/api/channels/nope/fault", { fault: "end" }), [404, "channel.not_found"]);
  const stream = String(pick((await send(t.app, "POST", "/api/channels", { name: "N", category: "News", streamUrl: "https://a.example/n.m3u8" }, token)).body, "data.id"));
  assert.deepEqual(await refusal(`/api/channels/${stream}/fault`, { fault: "end" }), [422, "channel.invalid"]);
  assert.equal((await send(t.app, "DELETE", "/api/channels/nope/fault", undefined, token)).status, 404);
});
