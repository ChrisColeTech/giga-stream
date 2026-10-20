/**
 * The other side of wave 0 (docs/62): without `REQUIRE_ACCOUNT_WRITES` — the desktop default —
 * every shared write behaves exactly as today. This file never sets the env, so `config.ts`
 * parses its default (`false`) and the guard registers nothing.
 */
import test from "node:test";
import assert from "node:assert/strict";

const { makeApp, pick, send } = await import("./app-fixture.js");

test("with the flag unset, one write per family answers as today", async () => {
  const t = await makeApp();
  const patched = await send(t.app, "PATCH", "/api/settings", { watchedPercent: 95 });
  assert.equal(patched.status, 200);
  assert.equal(pick(patched.body, "ok"), true);

  const favorite = await send(t.app, "PUT", "/api/favorites/title/tt111");
  assert.deepEqual(pick(favorite.body, "data"), { ref: { kind: "title", id: "tt111" }, favorite: true });

  const created = await send(t.app, "POST", "/api/collections", { name: "Friday night", type: "movie" });
  assert.equal(created.status, 201);

  const watch = await send(t.app, "PUT", "/api/watch", {
    item: { kind: "title", id: "tt100" },
    positionMs: 3000,
    playbackId: "p1",
    seq: 1,
  });
  assert.equal(pick(watch.body, "data.applied"), true);
  await t.dispose();
});
