import assert from "node:assert/strict";
import test from "node:test";

import { makeApp, pick, send } from "./app-fixture.js";
import { startFakeUpstream } from "./fake-backend.js";

test("the console and its API pass through with their paths intact", async () => {
  const upstream = await startFakeUpstream();
  const t = await makeApp({ adminProxyTarget: upstream.url });
  try {
    const entry = await send(t.app, "GET", "/admin");
    const console_ = await send(t.app, "GET", "/admin/jobs");
    const api = await send(t.app, "GET", "/api/admin/channels");
    assert.equal(pick(entry.body, "data.path"), "/admin");
    assert.equal(pick(console_.body, "data.path"), "/admin/jobs");
    assert.equal(pick(api.body, "data.path"), "/api/admin/channels");
  } finally {
    await t.dispose();
    await upstream.close();
  }
});

test("catalog Run alone reaches the external runner while the admin API stays local", async () => {
  const local = await startFakeUpstream();
  const runner = await startFakeUpstream();
  const t = await makeApp({ adminProxyTarget: local.url, catalogRunnerTarget: runner.url });
  try {
    const catalog = await send(t.app, "POST", "/api/admin/catalog-jobs/7/run", {});
    const jobs = await send(t.app, "GET", "/api/admin/jobs");
    assert.equal(pick(catalog.body, "data.path"), "/api/admin/catalog-jobs/7/run");
    assert.equal(pick(jobs.body, "data.path"), "/api/admin/jobs");
    assert.deepEqual(runner.seen.map((hit) => hit.path), ["/api/admin/catalog-jobs/7/run"]);
  } finally {
    await t.dispose();
    await Promise.all([local.close(), runner.close()]);
  }
});

test("live and logo bytes keep their prefixes and the account API stays this program's own", async () => {
  const upstream = await startFakeUpstream();
  const t = await makeApp({ adminProxyTarget: upstream.url });
  try {
    const live = await send(t.app, "GET", "/live/channel/master.m3u8");
    const logo = await send(t.app, "GET", "/logos/c/logo.png");
    assert.equal(pick(live.body, "data.path"), "/live/channel/master.m3u8");
    assert.equal(pick(logo.body, "data.path"), "/logos/c/logo.png");
    const account = await send(t.app, "GET", "/api/account/not-a-route");
    assert.equal(account.status, 404);
    assert.deepEqual(upstream.seen.map((hit) => hit.path), [
      "/live/channel/master.m3u8", "/logos/c/logo.png",
    ]);
  } finally {
    await t.dispose();
    await upstream.close();
  }
});

test("a proxied request carries the client: any seen chain, then the fileserver's direct peer", async () => {
  const upstream = await startFakeUpstream();
  const t = await makeApp({ adminProxyTarget: upstream.url });
  try {
    await t.app.inject({ method: "GET", url: "/api/admin/auth/login" });
    const landed = upstream.seen[upstream.seen.length - 1];
    assert.equal(landed?.path, "/api/admin/auth/login");
    assert.equal(landed?.forwardedFor, "127.0.0.1");

    await t.app.inject({
      method: "GET",
      url: "/api/admin/auth/login",
      headers: { "x-forwarded-for": "203.0.113.7" },
    });
    const relayed = upstream.seen[upstream.seen.length - 1];
    assert.equal(relayed?.forwardedFor, "203.0.113.7, 127.0.0.1");
  } finally {
    await t.dispose();
    await upstream.close();
  }
});

test("without a proxy target the admin API stays unroutable here", async () => {
  const t = await makeApp();
  try {
    const answer = await t.app.inject({ method: "GET", url: "/api/admin/channels" });
    assert.equal(answer.statusCode, 404);
    assert.deepEqual(answer.json().error.code, "route.not_found");
  } finally {
    await t.dispose();
  }
});
