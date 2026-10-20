// The account proxy (docs/62 sections 3.4 and D7): /api/account forwards beside /api/admin; with no env the
// boot falls back to the saved adminUrl setting; with neither, the proxy stays off.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";

import { makeApp, pick, pointAt, send } from "./app-fixture.js";
import { startFakeUpstream, type FakeUpstream } from "./fake-backend.js";

const upstreams: FakeUpstream[] = [];
after(async () => {
  for (const upstream of upstreams) await upstream.close();
});

test("the env set: /api/account forwards identity beside /api/admin, and the app's writes ride along", async () => {
  const up = await startFakeUpstream();
  upstreams.push(up);
  const t = await makeApp({ adminProxyTarget: up.url });

  const me = await send(t.app, "GET", "/api/account/me");
  assert.equal(me.status, 200);
  assert.equal(pick(me.body, "data.path"), "/api/account/me");

  const login = await send(t.app, "POST", "/api/account/auth/login", { username: "u", password: "p" });
  assert.equal(login.status, 200);
  assert.equal(pick(login.body, "data.path"), "/api/account/auth/login");

  const admin = await send(t.app, "GET", "/api/admin/channels");
  assert.equal(pick(admin.body, "data.path"), "/api/admin/channels", "the console's proxy is unchanged");

  const settings = await send(t.app, "GET", "/api/settings");
  assert.equal(pick(settings.body, "data.path"), undefined, "the fileserver's own /api stays here");
  assert.equal(up.seen.some((hit) => hit.path.startsWith("/api/settings")), false);
});

test("a forwarded /api/account request carries the forwarded-for chain like any proxied read", async () => {
  const up = await startFakeUpstream();
  upstreams.push(up);
  const t = await makeApp({ adminProxyTarget: up.url });

  await t.app.inject({
    method: "GET",
    url: "/api/account/favorites",
    headers: { "x-forwarded-for": "203.0.113.9" },
  });
  const hit = up.seen[up.seen.length - 1];
  assert.equal(hit?.path, "/api/account/favorites");
  assert.equal(hit?.forwardedFor, "203.0.113.9, 127.0.0.1");
});

test("no env: the saved adminUrl setting is the boot fallback (docs/62 D7)", async () => {
  const up = await startFakeUpstream();
  upstreams.push(up);
  // The setting is written first, on a data folder the second boot reopens: the proxy reads it at boot.
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-account-proxy-"));
  const writer = await makeApp({ dataDir });
  await pointAt(writer, up.url);
  await writer.dispose();

  const t = await makeApp({ dataDir });
  try {
    const me = await send(t.app, "GET", "/api/account/me");
    assert.equal(pick(me.body, "data.path"), "/api/account/me", "the setting points the whole proxy");
    const admin = await send(t.app, "GET", "/api/admin/channels");
    assert.equal(pick(admin.body, "data.path"), "/api/admin/channels");
  } finally {
    await t.dispose();
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("no env and no saved setting: the proxy stays off and every /api address stays here", async () => {
  const up = await startFakeUpstream();
  upstreams.push(up);
  const t = await makeApp();

  const me = await send(t.app, "GET", "/api/account/me");
  assert.equal(me.status, 404, "the fileserver has no /api/account routes of its own");
  assert.equal(pick(me.body, "error.code"), "route.not_found");
  assert.equal(up.seen.length, 0, "nothing reached the backend");
});
