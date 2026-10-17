import test from "node:test";
import assert from "node:assert/strict";

import { createSettingsService } from "../src/services/settings-service.js";
import { makeApp, pick, send } from "./app-fixture.js";

test("the packaged app's default admin address is the production backend until one is saved", () => {
  const stored = new Map<string, unknown>();
  const settings = createSettingsService({
    repository: { readAll: () => stored, writeMany: (rows) => rows.forEach((value, key) => stored.set(key, value)) },
    allowInsecureAdmin: false,
    now: () => 0,
    defaultAdminUrl: "http://127.0.0.1:8191",
  });
  assert.equal(settings.get().adminUrl, "http://127.0.0.1:8191");
  settings.patch({ adminUrl: "http://127.0.0.1:8091" });
  assert.equal(settings.get().adminUrl, "http://127.0.0.1:8091", "a saved address wins over the default");
});

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
      videoQuality: "auto",
      audioLanguage: null,
      lowLatency: false,
      pictureFit: "fit",
      resumeMode: "ask",
      watchedPercent: 90,
      liveOnOpen: "last",
      libraryView: "grid",
      librarySort: "newest",
      showContinue: true,
      subtitleLanguage: null,
      pauseHistory: false,
      rescanOnStartup: true,
      adminUrl: "http://127.0.0.1:8091",
    },
  });
  await t.dispose();
});

test("library rows patches and reads back while an invalid view is refused", async () => {
  const t = await makeApp();
  const patched = await send(t.app, "PATCH", "/api/settings", { libraryView: "rows" });
  assert.equal(patched.status, 200);
  assert.equal(pick(patched.body, "data.libraryView"), "rows");

  const read = await send(t.app, "GET", "/api/settings");
  assert.equal(read.status, 200);
  assert.equal(pick(read.body, "data.libraryView"), "rows");

  const refused = await send(t.app, "PATCH", "/api/settings", { libraryView: "shelves" });
  assert.equal(refused.status, 422);
  assert.equal(pick(refused.body, "error.code"), "settings.invalid");
  assert.equal(pick(refused.body, "error.message"), "Library view must be grid, list or rows.");

  const after = await send(t.app, "GET", "/api/settings");
  assert.equal(pick(after.body, "data.libraryView"), "rows");
  await t.dispose();
});

test("every key of docs/03 section 3.2's table patches and reads back committed", async () => {
  const t = await makeApp();
  const patched = await send(t.app, "PATCH", "/api/settings", {
    videoQuality: "saver",
    audioLanguage: "de",
    lowLatency: true,
    pictureFit: "fill",
    resumeMode: "resume",
    watchedPercent: 95,
    liveOnOpen: "none",
    librarySort: "az",
    showContinue: false,
    pauseHistory: true,
    rescanOnStartup: false,
  });
  assert.equal(patched.status, 200);
  const data = pick(patched.body, "data") as Record<string, unknown>;
  assert.equal(data.videoQuality, "saver");
  assert.equal(data.audioLanguage, "de");
  assert.equal(data.lowLatency, true);
  assert.equal(data.pictureFit, "fill");
  assert.equal(data.resumeMode, "resume");
  assert.equal(data.watchedPercent, 95);
  assert.equal(data.liveOnOpen, "none");
  assert.equal(data.librarySort, "az");
  assert.equal(data.showContinue, false);
  assert.equal(data.pauseHistory, true);
  assert.equal(data.rescanOnStartup, false);
  await t.dispose();
});

test("an invalid value on a new key refuses the whole patch, naming the row", async () => {
  const t = await makeApp();
  const refusals: Array<[Record<string, unknown>, string]> = [
    [{ videoQuality: "best" }, "Video quality must be auto, higher or saver."],
    [{ audioLanguage: "d" }, "Audio language must be a language tag or empty."],
    [{ lowLatency: "yes" }, "Low latency must be on or off."],
    [{ pictureFit: "stretch" }, "Picture fit must be fit, fill or original."],
    [{ resumeMode: "continue" }, "Resume must be ask, resume or restart."],
    [{ watchedPercent: 99 }, "Watched percent must be 90, 95 or 100."],
    [{ liveOnOpen: "first" }, "Live on open must be last or none."],
    [{ librarySort: "rating" }, "Library sort must be newest, oldest, az or year."],
    [{ showContinue: 1 }, "Show Continue must be on or off."],
    [{ pauseHistory: "no" }, "Pause history must be on or off."],
    [{ rescanOnStartup: null }, "Rescan on startup must be on or off."],
  ];
  for (const [row, message] of refusals) {
    const answer = await send(t.app, "PATCH", "/api/settings", row);
    assert.equal(answer.status, 422, JSON.stringify(row));
    assert.equal(pick(answer.body, "error.code"), "settings.invalid");
    assert.equal(pick(answer.body, "error.message"), message, JSON.stringify(row));
  }
  // Nothing committed by any refused patch: the defaults still stand.
  const after = await send(t.app, "GET", "/api/settings");
  assert.equal(pick(after.body, "data.watchedPercent"), 90);
  assert.equal(pick(after.body, "data.pictureFit"), "fit");
  await t.dispose();
});

test("the new keys survive a restart on the same data folder", async () => {
  const dataDir = (await import("node:fs")).mkdtempSync(
    (await import("node:path")).join((await import("node:os")).tmpdir(), "giga-settings-keys-"),
  );
  const first = await makeApp({ dataDir });
  const patched = await send(first.app, "PATCH", "/api/settings", {
    watchedPercent: 100,
    liveOnOpen: "none",
    librarySort: "year",
  });
  assert.equal(patched.status, 200);
  await first.dispose();

  const second = await makeApp({ dataDir });
  const after = await send(second.app, "GET", "/api/settings");
  assert.equal(pick(after.body, "data.watchedPercent"), 100);
  assert.equal(pick(after.body, "data.liveOnOpen"), "none");
  assert.equal(pick(after.body, "data.librarySort"), "year");
  await second.dispose();
  (await import("node:fs")).rmSync(dataDir, { recursive: true, force: true });
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
