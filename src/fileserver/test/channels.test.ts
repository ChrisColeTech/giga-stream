import test from "node:test";
import assert from "node:assert/strict";

import { makeApp, pick, pointAt, send, startBackend } from "./app-fixture.js";

// The one real backend this file shares, booted once and closed after the file.
const backend = await startBackend();

test("a refresh fills the live view from the real backend and answers the seeded channels", async () => {
  const t = await makeApp();
  await pointAt(t, backend.url);

  const refresh = await send(t.app, "POST", "/api/channels/refresh");
  assert.equal(refresh.status, 200);
  assert.equal(pick(refresh.body, "data.revision"), 4, "four seeded channels, each raising the revision");
  const items = pick(refresh.body, "data.items") as Array<Record<string, unknown>>;
  assert.equal(items.length, 4);
  assert.equal(items[0]?.id, "fx-news", "ordered by number, then name (docs/03 section 3.4)");
  assert.equal(items[0]?.number, "1");
  for (const channel of items) {
    // The verdict is a fact of this environment: the streaming test server may or may not be running
    // (docs/03 section 5.2). What the contract promises is that a probe ran and its answer rides along.
    assert.ok(channel.status === "live" || channel.status === "offline", `the probe gave a verdict: ${channel.status}`);
    assert.ok(typeof channel.checkedAt === "number", "the answer carries the probe round's times");
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

test("the last channel round-trips through the live view", async () => {
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
