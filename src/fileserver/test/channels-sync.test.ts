import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
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

test("the sync reads only the channel tables and makes no admin API request", async () => {
  const { backend, t } = await boot();
  await syncChannels(t);
  await send(t.app, "GET", "/api/channels");
  await send(t.app, "GET", "/api/state");
  await send(t.app, "PATCH", "/api/channels/last", { channelId: "a" });
  await syncChannels(t);

  assert.ok(backend.calls.length >= 2);
  for (const call of backend.calls) {
    assert.equal(call.url, `${FAKE_ADMIN_URL}/database/channels`, "never a stream URL");
    assert.notEqual(call.url, streamOf("a"));
    assert.equal(call.headers.get("authorization"), null);
    assert.equal(call.headers.get("cookie"), null);
    assert.equal(call.credentials, undefined);
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
  assert.deepEqual(idsOf(refreshed.body), ["b", "a"]);
  assert.equal(pick(refreshed.body, "data.revision"), 2);
  const state = await send(t.app, "GET", "/api/state");
  assert.equal(pick(state.body, "data.lastChannelId"), undefined);
  assert.equal((await send(t.app, "PATCH", "/api/channels/last", { channelId: "c" })).status, 404);
  await t.dispose();
});

test("a changed Turso source purges the cache and starts cold", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-source-"));
  const backend = fakeBackend(SET);
  const first = await makeApp({ dataDir, adminFetch: backend.fetch, tursoDatabaseUrl: "test://one" });
  await syncChannels(first);
  await first.dispose();
  backend.publish([{ id: "z", name: "Zeta" }]);
  const second = await makeApp({ dataDir, adminFetch: backend.fetch, tursoDatabaseUrl: "test://two" });
  const read = await send(second.app, "GET", "/api/channels");
  assert.deepEqual(idsOf(read.body), ["z"]);
  await second.dispose();
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
  const row = channelRowOf({ ...incoming, cachedLogoUrl: "http://127.0.0.1:4747/logos/c/x.png" }, 4);
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
  const plain = channelRowOf({ ...incoming, cachedLogoUrl: "" }, 0);
  assert.equal(plain.logoUrl, "https://img.example.test/x.png");
});
