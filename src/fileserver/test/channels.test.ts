import test from "node:test";
import assert from "node:assert/strict";

import { makeApp, pick, send } from "./app-fixture.js";
import { fakeBackend } from "./fake-backend.js";

const channels = [
  { id: "fx-news", name: "News", number: "1", category: "News" },
  { id: "fx-sports", name: "Sports", number: "2", category: "Sports" },
  { id: "fx-music", name: "Music", number: "3", category: "Music" },
  { id: "fx-kids", name: "Kids", number: "4", category: "Kids" },
];

async function boot() {
  const backend = fakeBackend(channels);
  return makeApp({ adminFetch: backend.fetch });
}

test("a refresh fills the cache from Turso and answers published channels in order", async () => {
  const t = await boot();

  const refresh = await send(t.app, "POST", "/api/channels/refresh");
  assert.equal(refresh.status, 200);
  assert.equal(pick(refresh.body, "data.revision"), 1);
  const items = pick(refresh.body, "data.items") as Array<Record<string, unknown>>;
  assert.equal(items.length, 4);
  assert.deepEqual(
    items.map((channel) => channel.id),
    ["fx-news", "fx-sports", "fx-music", "fx-kids"],
    "the cache keeps the SQL publication order",
  );
  assert.ok(items.some((channel) => channel.id === "fx-news" && channel.number === "1"));
  for (const channel of items) {
    // Nothing probes streams any more: no status, no probe time (docs/46 section D.2).
    assert.equal("status" in channel, false);
    assert.equal(channel.checkedAt, undefined);
  }
  const categories = pick(refresh.body, "data.categories") as Array<Record<string, unknown>>;
  assert.equal(categories.length, 4, "one category per seeded channel");
  await t.dispose();
});

test("q and category narrow the answer while the categories still count the whole view", async () => {
  const t = await boot();
  await send(t.app, "POST", "/api/channels/refresh");

  const byName = await send(t.app, "GET", "/api/channels?q=news");
  assert.equal(pick(byName.body, "data.items.0.id"), "fx-news");
  assert.equal(pick(byName.body, "data.items.length"), 1);

  const byNumber = await send(t.app, "GET", "/api/channels?q=3");
  assert.equal(pick(byNumber.body, "data.items.0.id"), "fx-music", "3 is the music channel's number");

  const byCategory = await send(t.app, "GET", "/api/channels?category=News");
  assert.equal(pick(byCategory.body, "data.items.length"), 1);
  const categories = pick(byCategory.body, "data.categories") as Array<Record<string, unknown>>;
  assert.equal(categories.length, 4, "categories are counted over the whole view, whatever narrows");
  await t.dispose();
});

test("the last channel round-trips through the cached channels", async () => {
  const t = await boot();
  await send(t.app, "POST", "/api/channels/refresh");

  const remembered = await send(t.app, "PATCH", "/api/channels/last", { channelId: "fx-news" });
  assert.equal(remembered.status, 200);
  const state = await send(t.app, "GET", "/api/state");
  assert.equal(pick(state.body, "data.lastChannelId"), "fx-news");

  const missing = await send(t.app, "PATCH", "/api/channels/last", { channelId: "no-such-channel" });
  assert.equal(missing.status, 404);
  assert.equal(pick(missing.body, "error.code"), "channel.not_found");
  await t.dispose();
});
