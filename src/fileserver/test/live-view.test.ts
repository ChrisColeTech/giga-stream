import test from "node:test";
import assert from "node:assert/strict";

import { backendToken, makeApp, pick, pointAt, send, startBackend } from "./app-fixture.js";

const backend = await startBackend();
const SEED_REVISION = 4;

test("a read within the TTL serves the view it holds; after the TTL the next read sees the backend's change", async () => {
  const t = await makeApp();
  await pointAt(t, backend.url);

  const first = await send(t.app, "GET", "/api/channels");
  assert.equal(pick(first.body, "data.revision"), SEED_REVISION);
  assert.equal(pick(first.body, "data.items.length"), 4);

  // A new channel in the real backend raises its revision; the fileserver does not know yet.
  const token = await backendToken(backend.url);
  const created = await fetch(`${backend.url}/api/channels`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: "FX Test",
      category: "Test",
      number: "1",
      streamUrl: "http://127.0.0.1:8097/live/fx-test/master.m3u8",
    }),
  });
  assert.equal(created.status, 201);

  // Within the TTL the view is fresh: the new channel is not served (docs/03 section 5.1).
  const cached = await send(t.app, "GET", "/api/channels");
  assert.equal(pick(cached.body, "data.items.length"), 4, "the TTL holds the view it has");

  // The clock moves past the TTL; the next read fetches and sees the change.
  t.clock.advance(31_000);
  const fresh = await send(t.app, "GET", "/api/channels");
  assert.equal(pick(fresh.body, "data.items.length"), 5);
  assert.equal(pick(fresh.body, "data.revision"), SEED_REVISION + 1);
  await t.dispose();
});

test("a refresh always re-reads, regardless of the TTL", async () => {
  const t = await makeApp();
  await pointAt(t, backend.url);
  await send(t.app, "GET", "/api/channels");
  const refreshed = await send(t.app, "POST", "/api/channels/refresh");
  assert.equal(pick(refreshed.body, "data.items.length"), 5, "the refresh sees the channel the last test made");
  await t.dispose();
});

test("a backend that does not answer clears the view and answers 503; the next request finds it again", async () => {
  const t = await makeApp();
  await pointAt(t, backend.url);
  await send(t.app, "POST", "/api/channels/refresh");

  // Point at a port nothing listens on: a real unreachable backend (docs/03 section 5.1).
  await send(t.app, "PATCH", "/api/settings", { adminUrl: "http://127.0.0.1:1" });
  const failed = await send(t.app, "POST", "/api/channels/refresh");
  assert.equal(failed.status, 503);
  assert.equal(pick(failed.body, "error.code"), "backend.unreachable");

  // The failed read cleared the view: an ordinary read answers empty, not stale.
  const empty = await send(t.app, "GET", "/api/channels");
  assert.equal(empty.status, 503);

  // The state answer carries the failure as a fact of the last read, not a live link.
  const state = await send(t.app, "GET", "/api/state");
  assert.equal(pick(state.body, "data.backend.connected"), false);
  assert.equal(pick(state.body, "data.backend.error.code"), "backend.unreachable");
  assert.deepEqual(pick(state.body, "data.channels.items"), []);

  // Back at the real backend, the next request is what finds it again.
  await pointAt(t, backend.url);
  const refilled = await send(t.app, "GET", "/api/channels");
  assert.equal(refilled.status, 200);
  assert.ok(Number(pick(refilled.body, "data.items.length")) >= 5);
  const stateAfter = await send(t.app, "GET", "/api/state");
  assert.equal(pick(stateAfter.body, "data.backend.connected"), true);
  await t.dispose();
});
