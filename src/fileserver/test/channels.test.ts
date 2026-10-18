import test from "node:test";
import assert from "node:assert/strict";

import { makeApp, pick, pointAt, send, startBackend } from "./app-fixture.js";

// The one real backend this file shares, booted once and closed after the file.
const backend = await startBackend();

test("a refresh fills the cache from the real backend and answers the seeded channels in its order", async () => {
  const t = await makeApp();
  await pointAt(t, backend.url);

  const refresh = await send(t.app, "POST", "/api/channels/refresh");
  assert.equal(refresh.status, 200);
  assert.equal(pick(refresh.body, "data.revision"), 4, "four seeded channels, each raising the revision");
  const items = pick(refresh.body, "data.items") as Array<Record<string, unknown>>;
  assert.equal(items.length, 4);
  const published = (await (await fetch(`${backend.url}/api/channels`)).json()) as { data: { items: Array<{ id: string }> } };
  assert.deepEqual(
    items.map((channel) => channel.id),
    published.data.items.map((channel) => channel.id),
    "the cache keeps the backend's order (docs/03 section 3.4)",
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
  const t = await makeApp();
  await pointAt(t, backend.url);
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
  const t = await makeApp();
  await pointAt(t, backend.url);
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
