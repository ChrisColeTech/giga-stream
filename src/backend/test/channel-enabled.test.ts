// `Enabled` on a channel (docs/26 sections 3.10 and 3.11): a disabled channel leaves every public read, a disabled
// live channel stops serving and is not started, and the admin reads still show it. The build is fake.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { removeDir } from "./db-kit.js";
import test from "node:test";

import { itemOf, itemsOf, liveBody, streamBody } from "./live-channel-kit.js";
import { makeApp, pick, send, signIn } from "./test-app.js";

const PUBLIC_KEYS = ["id", "name", "category", "number", "kind", "streamUrl", "logoUrl", "revision"];

test("a new channel is enabled; the public shape does not say so, the admin's does", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  const stream = await send(t.app, "POST", "/api/admin/channels", streamBody(), token);
  assert.equal(pick(stream.body, "data.enabled"), true);
  await send(t.app, "POST", "/api/admin/channels", liveBody(), token);
  const list = itemsOf((await send(t.app, "GET", "/api/channels")).body);
  assert.equal(list.length, 2);
  for (const item of list) assert.deepEqual(Object.keys(item).filter((k) => !PUBLIC_KEYS.includes(k)), [], String(item.id));
  const admin = itemsOf((await send(t.app, "GET", "/api/admin/channels", undefined, token)).body);
  assert.deepEqual(admin.map((c) => c.enabled), [true, true]);
});

test("a disabled stream channel leaves the public list and detail but stays in the admin's, and bumps the revision", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  const id = String(pick((await send(t.app, "POST", "/api/admin/channels", streamBody(), token)).body, "data.id"));
  const revision = async () => pick((await send(t.app, "GET", "/api/channels")).body, "data.revision");
  const before = await revision();
  const off = await send(t.app, "PATCH", `/api/admin/channels/${id}`, { enabled: false }, token);
  assert.deepEqual([off.status, pick(off.body, "data.enabled")], [200, false]);
  assert.equal(await revision(), Number(before) + 1, "readers learn of it through the revision");
  assert.deepEqual(itemsOf((await send(t.app, "GET", "/api/channels")).body), []);
  const detail = await send(t.app, "GET", `/api/channels/${id}`);
  assert.deepEqual([detail.status, pick(detail.body, "error.code")], [404, "channel.not_found"]);
  const admin = await send(t.app, "GET", "/api/admin/channels", undefined, token);
  assert.deepEqual([itemOf(admin.body, id).enabled, itemOf(admin.body, id).name], [false, "News"]);
  await send(t.app, "PATCH", `/api/admin/channels/${id}`, { enabled: true }, token);
  assert.equal(itemsOf((await send(t.app, "GET", "/api/channels")).body).length, 1);
  const refused = await send(t.app, "PATCH", `/api/admin/channels/${id}`, { enabled: "no" }, token);
  assert.deepEqual([refused.status, pick(refused.body, "error.details.field")], [422, "enabled"]);
});

test("a disabled live channel stops serving, is not started again, and an edit does not start it", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  await send(t.app, "POST", "/api/admin/channels", liveBody(), token);
  await t.live.settled();
  assert.deepEqual([(await send(t.app, "GET", "/live/home/master.m3u8")).status, (await send(t.app, "GET", "/logos/home.png")).status], [200, 200]);
  const off = await send(t.app, "PATCH", "/api/admin/channels/home", { enabled: false }, token);
  assert.deepEqual([pick(off.body, "data.enabled"), pick(off.body, "data.state")], [false, "stopped"]);
  assert.equal(t.tally.stopped, t.tally.built, "the runtime was stopped");
  const gone = await send(t.app, "GET", "/live/home/master.m3u8");
  assert.deepEqual([gone.status, pick(gone.body, "error.code")], [404, "channel.not_found"]);
  assert.equal((await send(t.app, "GET", "/logos/home.png")).status, 404);
  assert.equal(itemsOf((await send(t.app, "GET", "/api/channels")).body).length, 0);

  const built = t.tally.built;
  await send(t.app, "PATCH", "/api/admin/channels/home", { name: "Family" }, token);
  await t.live.settled();
  assert.equal(t.tally.built, built, "an edit of a disabled channel builds nothing");
  const rebuild = await send(t.app, "POST", "/api/admin/channels/home/rebuild", undefined, token);
  assert.deepEqual([rebuild.status, pick(rebuild.body, "error.details.field")], [422, "enabled"]);

  const on = await send(t.app, "PATCH", "/api/admin/channels/home", { enabled: true }, token);
  assert.deepEqual([pick(on.body, "data.enabled"), pick(on.body, "data.state")], [true, "preparing"]);
  await t.live.settled();
  assert.equal((await send(t.app, "GET", "/live/home/master.m3u8")).status, 200);
  assert.equal(itemsOf((await send(t.app, "GET", "/api/channels")).body).length, 1);
});

test("a disabled live channel is not built at start, and the admin still lists it", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-enabled-"));
  try {
    const first = await makeApp({ dataDir });
    const token = (await signIn(first.app)).access;
    await send(first.app, "POST", "/api/admin/channels", liveBody(), token);
    await send(first.app, "POST", "/api/admin/channels", liveBody({ id: "other", number: 8 }), token);
    await send(first.app, "PATCH", "/api/admin/channels/other", { enabled: false }, token);
    await first.dispose();
    const second = await makeApp({ dataDir });
    await second.live.settled();
    assert.equal(second.tally.built, 1, "only the enabled channel was built");
    const admin = await send(second.app, "GET", "/api/admin/channels", undefined, (await signIn(second.app)).access);
    assert.deepEqual([itemOf(admin.body, "home").state, itemOf(admin.body, "other").state, itemOf(admin.body, "other").enabled], ["live", "stopped", false]);
    assert.equal(pick((await send(second.app, "GET", "/healthz")).body, "data.liveChannels"), 2);
    await second.dispose();
  } finally {
    removeDir(dataDir);
  }
});
