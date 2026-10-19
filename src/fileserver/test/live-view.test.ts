import test from "node:test";
import assert from "node:assert/strict";

import { CACHE_WINDOW_MS } from "../src/constants/backend-cache.js";
import { backendToken, makeApp, pick, pointAt, send, startBackend, syncChannels } from "./app-fixture.js";

// The cache against the real backend child process: the fixture backend, one HTTP request per sync.
const backend = await startBackend();
const SEED_REVISION = 4;

test("a read inside the window serves the cache; a window later it answers the old list and the next read sees the change", async () => {
  const t = await makeApp();
  await pointAt(t, backend.url);

  const first = await send(t.app, "GET", "/api/channels");
  assert.equal(pick(first.body, "data.revision"), SEED_REVISION);
  assert.equal(pick(first.body, "data.items.length"), 4);

  // A new channel in the real backend raises its revision; the fileserver does not know yet.
  const token = await backendToken(backend.url);
  const created = await fetch(`${backend.url}/api/admin/channels`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: "FX Test",
      category: "Test",
      number: "1",
      streamUrl: "http://127.0.0.1:8091/live/fx-test/master.m3u8",
    }),
  });
  assert.equal(created.status, 201);

  const cached = await send(t.app, "GET", "/api/channels");
  assert.equal(pick(cached.body, "data.items.length"), 4, "inside the window the cache is what answers");

  // The clock moves a window on: the stale cache still answers at once (the refresh runs behind it) ...
  t.clock.advance(CACHE_WINDOW_MS);
  const stale = await send(t.app, "GET", "/api/channels");
  assert.equal(pick(stale.body, "data.items.length"), 4, "stale-while-revalidate answers from the cache");

  // ... and a read after that run sees the change. The refresh joins the run in flight or starts the sync.
  const fresh = await syncChannels(t);
  assert.equal(pick(fresh.body, "data.items.length"), 5);
  assert.equal(pick(fresh.body, "data.revision"), SEED_REVISION + 1);
  assert.equal(pick((await send(t.app, "GET", "/api/channels")).body, "data.items.length"), 5);
  await t.dispose();
});

test("a refresh always re-reads, whatever the window says", async () => {
  const t = await makeApp();
  await pointAt(t, backend.url);
  await send(t.app, "GET", "/api/channels");
  const refreshed = await syncChannels(t);
  assert.equal(pick(refreshed.body, "data.items.length"), 5, "the refresh sees the channel the last test made");
  await t.dispose();
});

test("a backend that does not answer is a 503 on refresh and an empty, honest answer on reads; the next address finds it again", async () => {
  const t = await makeApp();
  await pointAt(t, backend.url);
  await syncChannels(t);

  // Point at a port nothing listens on: a real unreachable backend. A different address is a different backend.
  await send(t.app, "PATCH", "/api/settings", { adminUrl: "http://127.0.0.1:1" });
  const failed = await syncChannels(t);
  assert.equal(failed.status, 503);
  assert.equal(pick(failed.body, "error.code"), "backend.unreachable");

  const empty = await send(t.app, "GET", "/api/channels");
  assert.equal(empty.status, 200, "a read never fails on a sync failure");
  assert.deepEqual(pick(empty.body, "data.items"), [], "the other backend's channels are not served");

  const state = await send(t.app, "GET", "/api/state");
  assert.equal(pick(state.body, "data.backend.connected"), false);
  assert.equal(pick(state.body, "data.backend.error.code"), "backend.unreachable");
  assert.deepEqual(pick(state.body, "data.channels.items"), []);

  // Back at the real backend, the next read is what finds it again.
  await pointAt(t, backend.url);
  const refilled = await send(t.app, "GET", "/api/channels");
  assert.equal(refilled.status, 200);
  assert.ok(Number(pick(refilled.body, "data.items.length")) >= 5);
  assert.equal(pick((await send(t.app, "GET", "/api/state")).body, "data.backend.connected"), true);
  await t.dispose();
});
