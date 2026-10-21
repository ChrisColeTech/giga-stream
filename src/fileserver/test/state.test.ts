import test from "node:test";
import assert from "node:assert/strict";

import { makeApp, pick, send, syncChannels } from "./app-fixture.js";
import { fakeBackend } from "./fake-backend.js";

const channels = [
  { id: "fx-news", name: "News", number: "1", category: "News" },
  { id: "fx-sports", name: "Sports", number: "2", category: "Sports" },
  { id: "fx-music", name: "Music", number: "3", category: "Music" },
  { id: "fx-kids", name: "Kids", number: "4", category: "Kids" },
];

const boot = () => {
  const backend = fakeBackend(channels);
  return makeApp({ adminFetch: backend.fetch });
};

test("the state answer is the complete picture in one request (docs/03 section 4)", async () => {
  const t = await boot();
  await syncChannels(t);

  const state = await send(t.app, "GET", "/api/state");
  assert.equal(state.status, 200);
  assert.ok(typeof pick(state.body, "data.version") === "string");
  assert.deepEqual(pick(state.body, "data.host"), { runtime: "browser" }, "the gateway runs without Electron");
  assert.equal(pick(state.body, "data.settings.adminUrl"), "http://127.0.0.1:8091");
  assert.deepEqual(pick(state.body, "data.shell"), { activeSurface: "library", paneVisibility: {}, paneSizes: {} });
  assert.equal(pick(state.body, "data.backend.connected"), true, "the last sync of the cache succeeded");
  assert.equal(typeof pick(state.body, "data.backend.readAt"), "number");
  assert.equal(pick(state.body, "data.backend.revision"), 1);
  assert.equal(pick(state.body, "data.channels.items.length"), 4);
  assert.deepEqual(pick(state.body, "data.collections"), [], "nothing was made yet");
  assert.deepEqual(pick(state.body, "data.jobs"), [], "no work ran yet");
  await t.dispose();
});

test("a collection and its settled jobs show up fresh in the state answer", async () => {
  const t = await makeApp();
  const made = await send(t.app, "POST", "/api/collections", { name: "State lane", type: "local" });
  assert.equal(made.status, 201);
  const state = await send(t.app, "GET", "/api/state");
  const collections = pick(state.body, "data.collections") as Array<{ name: string; itemCount: number }>;
  assert.deepEqual(
    collections.map((one) => [one.name, one.itemCount]),
    [["State lane", 0]],
  );
  assert.deepEqual(pick(state.body, "data.jobs"), []);
  await t.dispose();
});

test("the state answer's parts stand alone: a settings patch changes the settings and nothing else", async () => {
  const t = await boot();
  await syncChannels(t);

  await send(t.app, "PATCH", "/api/settings", { uiZoom: 2 });
  const state = await send(t.app, "GET", "/api/state");
  assert.equal(pick(state.body, "data.settings.uiZoom"), 2);
  assert.equal(pick(state.body, "data.channels.items.length"), 4, "the channel part is untouched");
  await t.dispose();
});

test("the last channel rides on the state answer only while liveOnOpen is last", async () => {
  const t = await boot();
  await send(t.app, "POST", "/api/channels/refresh");
  await send(t.app, "PATCH", "/api/channels/last", { channelId: "fx-news" });

  const withLast = await send(t.app, "GET", "/api/state");
  assert.equal(pick(withLast.body, "data.lastChannelId"), "fx-news", "the default (last) carries it");

  await send(t.app, "PATCH", "/api/settings", { liveOnOpen: "none" });
  const withoutLast = await send(t.app, "GET", "/api/state");
  assert.equal(pick(withoutLast.body, "data.lastChannelId"), undefined, "none omits it");

  // The stored channel is untouched: turning the setting back on resumes carrying it.
  const again = await send(t.app, "GET", "/api/state");
  await send(t.app, "PATCH", "/api/settings", { liveOnOpen: "last" });
  const restored = await send(t.app, "GET", "/api/state");
  assert.equal(pick(again.body, "data.lastChannelId"), undefined);
  assert.equal(pick(restored.body, "data.lastChannelId"), "fx-news");
  await t.dispose();
});

test("healthz answers the fileserver's own state and its view of the backend", async () => {
  const t = await boot();
  const before = await send(t.app, "GET", "/healthz");
  assert.equal(pick(before.body, "data.role"), "fileserver");
  assert.equal(pick(before.body, "data.backend"), "down", "nothing has been synced yet");

  await syncChannels(t);
  const after = await send(t.app, "GET", "/healthz");
  assert.equal(pick(after.body, "data.backend"), "up");
  await t.dispose();
});
