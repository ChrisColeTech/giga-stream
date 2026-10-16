import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { makeApp, pick, send } from "./app-fixture.js";

test("a fresh fileserver answers the default shell state", async () => {
  const t = await makeApp();
  const answer = await send(t.app, "GET", "/api/shell-state");
  assert.deepEqual(answer.body, {
    ok: true,
    data: { activeSurface: "library", paneVisibility: {}, paneSizes: {} },
  });
  await t.dispose();
});

test("a patch merges by pane id and survives a restart", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-shell-restart-"));
  const first = await makeApp({ dataDir });
  const patched = await send(first.app, "PATCH", "/api/shell-state", {
    activeSurface: "live",
    paneVisibility: { "live.channels": false },
    paneSizes: { "live.settings": [300] },
  });
  assert.equal(patched.status, 200);
  assert.equal(pick(patched.body, "data.activeSurface"), "live");

  // A second patch merges the pane maps per id, leaving the rest alone.
  const merged = await send(first.app, "PATCH", "/api/shell-state", {
    paneVisibility: { "library.rail": false },
  });
  const visibility = pick(merged.body, "data.paneVisibility") as Record<string, unknown>;
  assert.equal(visibility["live.channels"], false);
  assert.equal(visibility["library.rail"], false);
  const sizes = pick(merged.body, "data.paneSizes") as Record<string, unknown>;
  assert.deepEqual(sizes["live.settings"], [300]);
  await first.dispose();

  const second = await makeApp({ dataDir });
  const after = await send(second.app, "GET", "/api/shell-state");
  assert.equal(pick(after.body, "data.activeSurface"), "live");
  const visibilityAfter = pick(after.body, "data.paneVisibility") as Record<string, unknown>;
  assert.equal(visibilityAfter["live.channels"], false);
  await second.dispose();
  rmSync(dataDir, { recursive: true, force: true });
});

test("an unknown pane id or an out-of-bounds size refuses the whole patch", async () => {
  const t = await makeApp();
  const unknownPane = await send(t.app, "PATCH", "/api/shell-state", {
    paneSizes: { "live.stage": [500] },
  });
  assert.equal(unknownPane.status, 422);
  assert.equal(pick(unknownPane.body, "error.code"), "settings.invalid");

  const tooBig = await send(t.app, "PATCH", "/api/shell-state", {
    paneSizes: { "live.settings": [9999] },
  });
  assert.equal(tooBig.status, 422);

  const collapsed = await send(t.app, "PATCH", "/api/shell-state", {
    paneSizes: { "player.inspector": [0] },
  });
  assert.equal(collapsed.status, 200, "a collapsible pane may be sized 0 (collapsed)");
  await t.dispose();
});
