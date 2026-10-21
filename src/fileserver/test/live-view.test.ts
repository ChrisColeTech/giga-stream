import test from "node:test";
import assert from "node:assert/strict";

import { CACHE_WINDOW_MS } from "../src/constants/backend-cache.js";
import { makeApp, pick, send, syncChannels } from "./app-fixture.js";
import { fakeBackend } from "./fake-backend.js";

const initial = [
  { id: "one", name: "One", number: "1" }, { id: "two", name: "Two", number: "2" },
];

async function boot() {
  const backend = fakeBackend(initial);
  return { backend, t: await makeApp({ adminFetch: backend.fetch }) };
}

test("a read inside the window serves the cache; a window later it answers the old list and the next read sees the change", async () => {
  const { backend, t } = await boot();

  const first = await send(t.app, "GET", "/api/channels");
  assert.equal(pick(first.body, "data.revision"), 1);
  assert.equal(pick(first.body, "data.items.length"), 2);

  // A new channel in the real backend raises its revision; the fileserver does not know yet.
  backend.publish([...initial, { id: "three", name: "Three", number: "3" }]);

  const cached = await send(t.app, "GET", "/api/channels");
  assert.equal(pick(cached.body, "data.items.length"), 2, "inside the window the cache is what answers");

  // The clock moves a window on: the stale cache still answers at once (the refresh runs behind it) ...
  t.clock.advance(CACHE_WINDOW_MS);
  const stale = await send(t.app, "GET", "/api/channels");
  assert.equal(pick(stale.body, "data.items.length"), 2, "stale-while-revalidate answers from the cache");

  // ... and a read after that run sees the change. The refresh joins the run in flight or starts the sync.
  const fresh = await syncChannels(t);
  assert.equal(pick(fresh.body, "data.items.length"), 3);
  assert.equal(pick(fresh.body, "data.revision"), 2);
  assert.equal(pick((await send(t.app, "GET", "/api/channels")).body, "data.items.length"), 3);
  await t.dispose();
});

test("a refresh always re-reads, whatever the window says", async () => {
  const { backend, t } = await boot();
  await send(t.app, "GET", "/api/channels");
  backend.publish([...initial, { id: "three", name: "Three", number: "3" }]);
  const refreshed = await syncChannels(t);
  assert.equal(pick(refreshed.body, "data.items.length"), 3);
  await t.dispose();
});

test("a Turso failure is 503 on refresh while the warm view remains", async () => {
  const { backend, t } = await boot();
  await syncChannels(t);

  // Point at a port nothing listens on: a real unreachable backend. A different address is a different backend.
  backend.setDown(true);
  const failed = await syncChannels(t);
  assert.equal(failed.status, 503);
  assert.equal(pick(failed.body, "error.code"), "backend.unreachable");

  const held = await send(t.app, "GET", "/api/channels");
  assert.equal(held.status, 200, "a read never fails on a sync failure");
  assert.equal(pick(held.body, "data.items.length"), 2);

  const state = await send(t.app, "GET", "/api/state");
  assert.equal(pick(state.body, "data.backend.connected"), false);
  assert.equal(pick(state.body, "data.backend.error.code"), "backend.unreachable");
  assert.equal(pick(state.body, "data.channels.items.length"), 2);

  // Back at the real backend, the next read is what finds it again.
  backend.setDown(false);
  const refilled = await send(t.app, "GET", "/api/channels");
  assert.equal(refilled.status, 200);
  assert.equal(pick(refilled.body, "data.items.length"), 2);
  await t.dispose();
});
