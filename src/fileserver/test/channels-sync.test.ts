import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { channelRowOf } from "../src/services/channels-sync.js";
import { makeApp, pick, pointAt, send, syncChannels } from "./app-fixture.js";
import { FAKE_ADMIN_URL, fakeBackend, streamOf, type FakeChannel } from "./fake-backend.js";

const SET: FakeChannel[] = [
  { id: "a", name: "Alpha News", number: "2", category: "News" },
  { id: "b", name: "Beta", number: "1", category: "Music" },
  { id: "c", name: "Gamma 100%", category: "News" },
];

async function boot(channels: FakeChannel[] = SET) {
  const backend = fakeBackend(channels);
  const t = await makeApp({ adminFetch: backend.fetch });
  await pointAt(t, FAKE_ADMIN_URL);
  return { backend, t };
}

const idsOf = (body: unknown): string[] => (pick(body, "data.items") as Array<{ id: string }>).map((one) => one.id);

test("the sync asks only the public channel list: no stream address, no Authorization, no cookie", async () => {
  const { backend, t } = await boot();
  await syncChannels(t);
  await send(t.app, "GET", "/api/channels");
  await send(t.app, "GET", "/api/state");
  await send(t.app, "PATCH", "/api/channels/last", { channelId: "a" });
  await syncChannels(t);

  assert.ok(backend.calls.length >= 2);
  for (const call of backend.calls) {
    assert.equal(call.url, `${FAKE_ADMIN_URL}/api/channels`, "never a stream URL");
    assert.notEqual(call.url, streamOf("a"));
    assert.equal(call.headers.get("authorization"), null);
    assert.equal(call.headers.get("cookie"), null);
    assert.equal(call.credentials, "omit");
  }
  await t.dispose();
});

test("a channel the backend unpublishes is swept, and so is a last channel that named it", async () => {
  const { backend, t } = await boot();
  await syncChannels(t);
  await send(t.app, "PATCH", "/api/channels/last", { channelId: "c" });
  assert.equal(pick((await send(t.app, "GET", "/api/state")).body, "data.lastChannelId"), "c");

  backend.publish([SET[0] as FakeChannel, SET[1] as FakeChannel]);
  const refreshed = await syncChannels(t);
  assert.deepEqual(idsOf(refreshed.body), ["a", "b"]);
  assert.equal(pick(refreshed.body, "data.revision"), 2);
  const state = await send(t.app, "GET", "/api/state");
  assert.equal(pick(state.body, "data.lastChannelId"), undefined);
  assert.equal((await send(t.app, "PATCH", "/api/channels/last", { channelId: "c" })).status, 404);
  await t.dispose();
});

test("a changed adminUrl purges the cache and the next read starts cold from the new backend", async () => {
  const { backend, t } = await boot();
  await syncChannels(t);
  backend.publish([{ id: "z", name: "Zeta" }]);
  await pointAt(t, "http://127.0.0.1:4848");

  const read = await send(t.app, "GET", "/api/channels");
  assert.deepEqual(idsOf(read.body), ["z"], "nothing of the old backend is left");
  assert.equal(backend.calls.at(-1)?.url, "http://127.0.0.1:4848/api/channels");

  backend.setDown(true);
  await pointAt(t, "http://127.0.0.1:4949");
  const empty = await send(t.app, "GET", "/api/channels");
  assert.equal(empty.status, 200);
  assert.deepEqual(idsOf(empty.body), [], "the old rows were purged, not served for the new address");
  assert.equal(pick((await send(t.app, "GET", "/api/state")).body, "data.backend.connected"), false);
  await t.dispose();
});

test("quitting aborts a sync in flight and nothing is written afterwards", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-quit-"));
  const backend = fakeBackend(SET);
  const t = await makeApp({ dataDir, adminFetch: backend.fetch });
  await pointAt(t, FAKE_ADMIN_URL);
  backend.setStalled(true);
  const pending = syncChannels(t);
  while (backend.calls.length === 0) await new Promise((resolve) => setImmediate(resolve));

  await t.dispose();
  assert.equal((await pending).status, 503);

  const db = new DatabaseSync(path.join(dataDir, "giga-stream.db"), { readOnly: true });
  const state = db.prepare("SELECT synced_at, error_code FROM cache_state WHERE dataset = 'channels'").get();
  assert.deepEqual({ ...state }, { synced_at: null, error_code: null }, "an attempt was stamped; no result was");
  assert.deepEqual({ ...db.prepare("SELECT COUNT(*) AS n FROM cached_channels").get() }, { n: 0 });
  db.close();
  rmSync(dataDir, { recursive: true, force: true });
});

test("q matches name and number as plain text, category narrows, categories count the whole cache", async () => {
  const { t } = await boot();
  await syncChannels(t);
  assert.deepEqual(idsOf((await send(t.app, "GET", "/api/channels?q=ALPHA")).body), ["a"]);
  assert.deepEqual(idsOf((await send(t.app, "GET", "/api/channels?q=2")).body), ["a"], "the number");
  assert.deepEqual(idsOf((await send(t.app, "GET", "/api/channels?q=%25")).body), ["c"], "% is literal");
  const news = await send(t.app, "GET", "/api/channels?category=News");
  assert.deepEqual(idsOf(news.body), ["a", "c"]);
  assert.deepEqual(pick(news.body, "data.categories"), [
    { value: "Music", count: 1 },
    { value: "News", count: 2 },
  ]);
  const item = pick(news.body, "data.items.0") as Record<string, unknown>;
  assert.equal(item.streamUrl, streamOf("a"));
  assert.equal(item.checkedAt, undefined, "no probe facts any more");
  await t.dispose();
});

test("the channel mapper picks named fields and prefers the backend's cached logo, made absolute", () => {
  const incoming = {
    id: "x",
    name: "X",
    category: "News",
    number: "7",
    logoUrl: "https://img.example.test/x.png",
    cachedLogoUrl: "/logos/c/x.png",
    revision: 5,
    streamUrl: "http://s.example.test/x.m3u8",
    status: "dead",
    tvgId: "x.tv",
    source: "Playlist",
    playlistName: "P",
    enabled: true,
  };
  const row = channelRowOf(incoming, 4, "http://127.0.0.1:4747");
  assert.deepEqual(row, {
    id: "x",
    position: 4,
    name: "X",
    category: "News",
    number: "7",
    logoUrl: "http://127.0.0.1:4747/logos/c/x.png",
    streamUrl: "http://s.example.test/x.m3u8",
    revision: 5,
  });
  const plain = channelRowOf({ ...incoming, cachedLogoUrl: "" }, 0, "http://127.0.0.1:4747");
  assert.equal(plain.logoUrl, "https://img.example.test/x.png");
});
