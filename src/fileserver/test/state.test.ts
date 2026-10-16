import test from "node:test";
import assert from "node:assert/strict";

import { makeApp, pick, pointAt, send, startBackend } from "./app-fixture.js";

const backend = await startBackend();

test("the state answer is the complete picture in one request (docs/03 section 4)", async () => {
  const t = await makeApp();
  await pointAt(t, backend.url);

  const state = await send(t.app, "GET", "/api/state");
  assert.equal(state.status, 200);
  assert.ok(typeof pick(state.body, "data.version") === "string");
  assert.deepEqual(pick(state.body, "data.host"), { runtime: "browser" }, "the gateway runs without Electron");
  assert.equal(pick(state.body, "data.settings.adminUrl"), backend.url);
  assert.deepEqual(pick(state.body, "data.shell"), { activeSurface: "library", paneVisibility: {}, paneSizes: {} });
  assert.equal(pick(state.body, "data.backend.connected"), true, "the read itself filled the live view");
  assert.ok(Number(pick(state.body, "data.backend.revision")) >= 4);
  assert.equal(pick(state.body, "data.channels.items.length"), 4);
  assert.deepEqual(pick(state.body, "data.collections"), [], "nothing was made yet");
  assert.deepEqual(pick(state.body, "data.jobs"), [], "no work ran yet");
  await t.dispose();
});

test("a collection and its settled jobs show up fresh in the state answer", async () => {
  const t = await makeApp();
  const made = await send(t.app, "POST", "/api/collections", { name: "State lane" });
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
  const t = await makeApp();
  await pointAt(t, backend.url);
  await send(t.app, "GET", "/api/state");

  await send(t.app, "PATCH", "/api/settings", { uiZoom: 2 });
  const state = await send(t.app, "GET", "/api/state");
  assert.equal(pick(state.body, "data.settings.uiZoom"), 2);
  assert.equal(pick(state.body, "data.channels.items.length"), 4, "the channel part is untouched");
  await t.dispose();
});

test("healthz answers the fileserver's own state and its view of the backend", async () => {
  const t = await makeApp();
  await pointAt(t, backend.url);
  const before = await send(t.app, "GET", "/healthz");
  assert.equal(pick(before.body, "data.role"), "fileserver");
  assert.equal(pick(before.body, "data.backend"), "down", "no read has happened yet");

  await send(t.app, "GET", "/api/state");
  const after = await send(t.app, "GET", "/healthz");
  assert.equal(pick(after.body, "data.backend"), "up");
  await t.dispose();
});
