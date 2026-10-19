import test from "node:test";
import assert from "node:assert/strict";
import { after } from "node:test";

import { makeApp, pick, send } from "./app-fixture.js";
import { startFakeUpstream, type FakeUpstream } from "./fake-backend.js";

const upstreams: FakeUpstream[] = [];
after(async () => {
  for (const upstream of upstreams) await upstream.close();
});

test("the backend's admin API passes through identity, the console entry arrives stripped", async () => {
  const up = await startFakeUpstream();
  upstreams.push(up);
  const t = await makeApp({ adminProxyTarget: up.url });

  const admin = await send(t.app, "GET", "/api/admin/channels");
  assert.equal(admin.status, 200);
  assert.equal(pick(admin.body, "data.path"), "/api/admin/channels");

  const session = await send(t.app, "GET", "/api/admin/auth/session");
  assert.equal(session.status, 200);
  assert.equal(pick(session.body, "data.path"), "/api/admin/auth/session");

  const entry = await send(t.app, "GET", "/admin/");
  assert.equal(entry.status, 200);
  assert.equal(pick(entry.body, "data.path"), "/", "the console's index comes from the backend root");
});

test("/live and /logos reach the backend with their prefix intact", async () => {
  const up = await startFakeUpstream();
  upstreams.push(up);
  const t = await makeApp({ adminProxyTarget: up.url });

  const live = await send(t.app, "GET", "/live/ch-1/master.m3u8");
  assert.equal(live.status, 200);
  assert.equal(pick(live.body, "data.path"), "/live/ch-1/master.m3u8");

  const logos = await send(t.app, "GET", "/logos/channel-logo.png");
  assert.equal(logos.status, 200);
  assert.equal(pick(logos.body, "data.path"), "/logos/channel-logo.png");
});

test("a proxied request carries the client: any seen chain, then the fileserver's direct peer", async () => {
  const up = await startFakeUpstream();
  upstreams.push(up);
  const t = await makeApp({ adminProxyTarget: up.url });

  const plain = await t.app.inject({ method: "GET", url: "/live/ch-1/master.m3u8" });
  const landed = up.seen[up.seen.length - 1];
  assert.equal(landed?.path, "/live/ch-1/master.m3u8");
  assert.equal(landed?.forwardedFor, "127.0.0.1");

  const relayed = await t.app.inject({
    method: "GET",
    url: "/live/ch-1/master.m3u8",
    headers: { "x-forwarded-for": "203.0.113.7" },
  });
  const relayedHit = up.seen[up.seen.length - 1];
  assert.equal(relayedHit?.path, "/live/ch-1/master.m3u8");
  assert.equal(relayedHit?.forwardedFor, "203.0.113.7, 127.0.0.1");
  assert.equal(relayed.statusCode, plain.statusCode);

  await t.app.inject({ method: "GET", url: "/api/admin/channels" });
  const adminHit = up.seen[up.seen.length - 1];
  assert.equal(adminHit?.path, "/api/admin/channels");
  assert.equal(adminHit?.forwardedFor, "127.0.0.1", "the identity registration forwards the peer too");
});

test("the fileserver's own /api, /healthz and SPA addresses never reach the proxy", async () => {
  const up = await startFakeUpstream();
  upstreams.push(up);
  const t = await makeApp({ adminProxyTarget: up.url });

  const settings = await send(t.app, "GET", "/api/settings");
  assert.equal(settings.status, 200);
  assert.equal(typeof pick(settings.body, "data.adminUrl"), "string", "the fileserver's own settings");
  assert.equal(pick(settings.body, "data.path"), undefined, "not the upstream's echo");

  const health = await send(t.app, "GET", "/healthz");
  assert.equal(health.status, 200);
  assert.equal(pick(health.body, "ok"), true);
  assert.equal(up.seen.length, 0, "no request left this fileserver for the upstream");
});
