/**
 * Wave 0 of the accounts plan (docs/62): with `REQUIRE_ACCOUNT_WRITES` set, a deployment refuses
 * every write to the shared settings, favorites, collections and watch families with the standard
 * envelope, `403 writes.closed`, while every read keeps answering. The env is set before the
 * fixture import, which is the one moment `src/config.ts` reads the process environment.
 */
process.env.REQUIRE_ACCOUNT_WRITES = "true";

import test from "node:test";
import assert from "node:assert/strict";

const { makeApp, pick, send } = await import("./app-fixture.js");

test("with the flag on, every write verb on the four families is 403 writes.closed", async () => {
  const t = await makeApp();
  const writes = [
    ["PATCH /api/settings", await send(t.app, "PATCH", "/api/settings", { theme: "dark" })],
    ["PUT /api/favorites/title/tt111", await send(t.app, "PUT", "/api/favorites/title/tt111")],
    ["DELETE /api/favorites/title/tt111", await send(t.app, "DELETE", "/api/favorites/title/tt111")],
    ["POST /api/collections", await send(t.app, "POST", "/api/collections", { name: "Friday", type: "manual" })],
    ["PATCH /api/collections/c1", await send(t.app, "PATCH", "/api/collections/c1", { name: "Saturday" })],
    ["DELETE /api/collections/c1", await send(t.app, "DELETE", "/api/collections/c1")],
    ["PUT /api/collections/c1/items", await send(t.app, "PUT", "/api/collections/c1/items", { kind: "title", id: "tt1" })],
    ["DELETE /api/collections/c1/items/title/tt1", await send(t.app, "DELETE", "/api/collections/c1/items/title/tt1")],
    [
      "PUT /api/watch",
      await send(t.app, "PUT", "/api/watch", { item: { kind: "title", id: "tt100" }, positionMs: 1, playbackId: "p1", seq: 1 }),
    ],
    ["DELETE /api/watch/w1", await send(t.app, "DELETE", "/api/watch/w1")],
    ["DELETE /api/watch", await send(t.app, "DELETE", "/api/watch")],
  ] as const;
  for (const [name, answer] of writes) {
    assert.equal(answer.status, 403, name);
    assert.equal(pick(answer.body, "ok"), false, name);
    assert.equal(pick(answer.body, "error.code"), "writes.closed", name);
    assert.equal(typeof pick(answer.body, "error.message"), "string", name);
  }
  await t.dispose();
});

test("with the flag on, the families' reads keep answering normally", async () => {
  const t = await makeApp();
  const settings = await send(t.app, "GET", "/api/settings");
  assert.equal(settings.status, 200);
  assert.equal(pick(settings.body, "ok"), true);
  const collections = await send(t.app, "GET", "/api/collections");
  assert.equal(collections.status, 200);
  assert.deepEqual(pick(collections.body, "data"), []);
  const items = await send(t.app, "GET", "/api/items/title/tt1/collections");
  assert.equal(items.status, 200);
  assert.deepEqual(pick(items.body, "data"), []);
  await t.dispose();
});

test("the refusal is the one sentence, whatever the route or the verb", async () => {
  const t = await makeApp();
  const first = await send(t.app, "PUT", "/api/favorites/title/tt111");
  const second = await send(t.app, "DELETE", "/api/watch");
  assert.equal(pick(first.body, "error.message"), pick(second.body, "error.message"));
  assert.notEqual(pick(first.body, "error.message"), "");
  await t.dispose();
});
