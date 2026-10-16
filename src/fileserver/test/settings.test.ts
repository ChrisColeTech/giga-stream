import test from "node:test";
import assert from "node:assert/strict";

import { makeApp, pick, send } from "./app-fixture.js";

test("a fresh fileserver answers every setting at its default, with the admin address included", async () => {
  const t = await makeApp();
  const answer = await send(t.app, "GET", "/api/settings");
  assert.equal(answer.status, 200);
  assert.deepEqual(answer.body, {
    ok: true,
    data: {
      autoplay: false,
      theme: "dark",
      themeAccent: "amber",
      reducedMotion: "system",
      uiZoom: 1,
      libraryView: "grid",
      subtitleLanguage: null,
      adminUrl: "http://127.0.0.1:8091",
    },
  });
});

test("a patch commits the changed rows and returns the committed settings; it survives a restart", async () => {
  const dataDir = (await import("node:fs")).mkdtempSync(
    (await import("node:path")).join((await import("node:os")).tmpdir(), "giga-settings-restart-"),
  );
  const first = await makeApp({ dataDir });
  const patched = await send(first.app, "PATCH", "/api/settings", { uiZoom: 1.5, theme: "light" });
  assert.equal(patched.status, 200);
  assert.equal(pick(patched.body, "data.uiZoom"), 1.5);
  assert.equal(pick(patched.body, "data.theme"), "light");
  // A no-change row does not rewrite, and the answer is the whole committed settings.
  const again = await send(first.app, "PATCH", "/api/settings", { uiZoom: 1.5 });
  assert.deepEqual(again.body, patched.body);
  await first.dispose();

  // The same data folder opened again reads the stored rows back (docs/03 section 3.2).
  const second = await makeApp({ dataDir });
  const after = await send(second.app, "GET", "/api/settings");
  assert.equal(pick(after.body, "data.uiZoom"), 1.5);
  assert.equal(pick(after.body, "data.theme"), "light");
  await second.dispose();
  (await import("node:fs")).rmSync(dataDir, { recursive: true, force: true });
});

test("an invalid or unknown row refuses the whole patch, naming the row", async () => {
  const t = await makeApp();
  const unknown = await send(t.app, "PATCH", "/api/settings", { uiZoom: 1, nope: 1 });
  assert.equal(unknown.status, 422);
  assert.equal(pick(unknown.body, "error.code"), "settings.invalid");

  const invalid = await send(t.app, "PATCH", "/api/settings", { uiZoom: 9 });
  assert.equal(invalid.status, 422);
  assert.equal(pick(invalid.body, "error.code"), "settings.invalid");

  // Nothing committed: the settings still read at their defaults.
  const after = await send(t.app, "GET", "/api/settings");
  assert.equal(pick(after.body, "data.uiZoom"), 1);
  await t.dispose();
});

test("an admin address off loopback must be https unless the dev override is set", async () => {
  const t = await makeApp();
  const refused = await send(t.app, "PATCH", "/api/settings", { adminUrl: "http://10.0.0.5:8091" });
  assert.equal(refused.status, 422);
  assert.equal(pick(refused.body, "error.code"), "backend.tls_required");

  const normalized = await send(t.app, "PATCH", "/api/settings", {
    adminUrl: "https://backend.example.com/",
  });
  assert.equal(pick(normalized.body, "data.adminUrl"), "https://backend.example.com");
  await t.dispose();
});
