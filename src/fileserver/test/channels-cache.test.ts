import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { CACHE_WINDOW_MS } from "../src/constants/backend-cache.js";
import { makeApp, pick, pointAt, send, syncChannels, testClock } from "./app-fixture.js";
import { FAKE_ADMIN_URL, fakeBackend, type FakeChannel } from "./fake-backend.js";

const THREE: FakeChannel[] = [
  { id: "a", name: "Alpha News", number: "2", category: "News" },
  { id: "b", name: "Beta", number: "1", category: "Music" },
  { id: "c", name: "Gamma 100%", category: "News" },
];

async function boot(channels: FakeChannel[] = THREE, options: { dataDir?: string; syncOnStart?: boolean } = {}) {
  const backend = fakeBackend(channels);
  const t = await makeApp({ adminFetch: backend.fetch, ...options });
  await pointAt(t, FAKE_ADMIN_URL);
  return { backend, t };
}

const idsOf = (body: unknown): string[] => (pick(body, "data.items") as Array<{ id: string }>).map((one) => one.id);
/** One turn of the event loop: lets a just-sent request reach the service (no wall-clock wait). */
const turn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

test("a cold cache awaits its first sync, then answers in the backend's order from the database", async () => {
  const { backend, t } = await boot();
  const first = await send(t.app, "GET", "/api/channels");
  assert.deepEqual(idsOf(first.body), ["b", "a", "c"], "number, then name");
  assert.equal(pick(first.body, "data.revision"), 1);
  assert.equal(backend.channelCalls().length, 1);
  await send(t.app, "GET", "/api/channels?q=beta");
  await send(t.app, "GET", "/api/state");
  assert.equal(backend.calls.length, 1, "reads inside the window never go back to the backend");
  await t.dispose();
});

test("the state answer never awaits a cold sync", async () => {
  const { backend, t } = await boot();
  const release = backend.hold();
  const state = await send(t.app, "GET", "/api/state");
  assert.equal(state.status, 200);
  assert.deepEqual(pick(state.body, "data.channels.items"), []);
  assert.equal(pick(state.body, "data.backend.connected"), false);
  assert.equal(backend.calls.length, 1, "the first sync was started, detached");
  release();
  await t.dispose();
});

test("a warm cache a window old answers at once and refreshes once, even under ten concurrent reads", async () => {
  const { backend, t } = await boot();
  await syncChannels(t);
  const before = backend.calls.length;
  backend.publish([...THREE, { id: "d", name: "Delta" }]);
  t.clock.advance(CACHE_WINDOW_MS);
  const release = backend.hold();

  const reads = await Promise.all(Array.from({ length: 10 }, () => send(t.app, "GET", "/api/channels")));
  for (const read of reads) assert.deepEqual(idsOf(read.body), ["b", "a", "c"], "the stale cache answered now");
  assert.equal(backend.calls.length, before + 1, "exactly one backend fetch for ten reads");

  const joined = syncChannels(t);
  await turn();
  release();
  assert.deepEqual(idsOf((await joined).body), ["b", "a", "c", "d"]);
  assert.equal(backend.calls.length, before + 1, "the manual refresh joined the run in flight");
  assert.deepEqual(idsOf((await send(t.app, "GET", "/api/channels")).body), ["b", "a", "c", "d"]);
  assert.equal(backend.calls.length, before + 1, "fresh again: no further fetch");
  await t.dispose();
});

test("5 h 59 min is still fresh and reads make no request", async () => {
  const { backend, t } = await boot();
  await syncChannels(t);
  t.clock.advance(CACHE_WINDOW_MS - 60_000);
  await send(t.app, "GET", "/api/channels");
  await send(t.app, "GET", "/api/state");
  assert.equal(backend.calls.length, 1);
  await t.dispose();
});

test("with the backend down the cache keeps serving and its age does not change", async () => {
  const { backend, t } = await boot();
  await syncChannels(t);
  const readAt = pick((await send(t.app, "GET", "/api/state")).body, "data.backend.readAt");
  assert.equal(typeof readAt, "number");

  t.clock.advance(CACHE_WINDOW_MS + 60_000);
  backend.setDown(true);
  const read = await send(t.app, "GET", "/api/channels");
  assert.equal(read.status, 200);
  assert.deepEqual(idsOf(read.body), ["b", "a", "c"]);
  assert.equal((await syncChannels(t)).status, 503, "a manual refresh learns the backend is down");

  const state = await send(t.app, "GET", "/api/state");
  assert.equal(pick(state.body, "data.backend.connected"), false);
  assert.equal(pick(state.body, "data.backend.error.code"), "backend.unreachable");
  assert.equal(pick(state.body, "data.backend.readAt"), readAt, "readAt is the cache age, not the failure time");
  assert.equal(pick(state.body, "data.channels.items.length"), 3);
  await t.dispose();
});

test("a failed manual refresh answers 503 or 502 and leaves the cache intact", async () => {
  const { backend, t } = await boot();
  await syncChannels(t);
  backend.setDown(true);
  const failed = await syncChannels(t);
  assert.equal(failed.status, 503);
  assert.equal(pick(failed.body, "error.code"), "backend.unreachable");
  assert.equal(idsOf((await send(t.app, "GET", "/api/channels")).body).length, 3);
  await t.dispose();

});

test("a restart on the same data folder serves the cache with the backend down", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-restart-"));
  const clock = testClock();
  const backend = fakeBackend(THREE);
  const first = await makeApp({ dataDir, clock, adminFetch: backend.fetch });
  await pointAt(first, FAKE_ADMIN_URL);
  await syncChannels(first);
  await first.dispose();

  backend.setDown(true);
  // The launch also checks the (never synced) titles; this fake serves channels only, so count the channel reads.
  const calls = backend.channelCalls().length;
  const second = await makeApp({ dataDir, clock, adminFetch: backend.fetch, syncOnStart: true });
  const read = await send(second.app, "GET", "/api/channels");
  assert.deepEqual(idsOf(read.body), ["b", "a", "c"]);
  assert.equal(pick((await send(second.app, "GET", "/api/state")).body, "data.backend.connected"), true);
  assert.equal(backend.channelCalls().length, calls, "inside the window the launch check makes no channel request");
  await second.dispose();

  clock.advance(CACHE_WINDOW_MS);
  const third = await makeApp({ dataDir, clock, adminFetch: backend.fetch, syncOnStart: true });
  assert.deepEqual(idsOf((await send(third.app, "GET", "/api/channels")).body), ["b", "a", "c"]);
  await syncChannels(third);
  assert.ok(backend.channelCalls().length > calls, "a stale channels cache is checked at launch, detached");
  await third.dispose();
  rmSync(dataDir, { recursive: true, force: true });
});
