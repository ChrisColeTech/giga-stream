import test from "node:test";
import assert from "node:assert/strict";

import { createSettingsService } from "../src/services/settings-service.js";
import { makeApp, pick, send } from "./app-fixture.js";

test("the library's view, sort, scope, source, genres, year and watched filter save and read back", async () => {
  const t = await makeApp();
  const saved = {
    libraryScope: "tv",
    librarySource: "collection:abc",
    libraryGenres: ["Drama", "Sci-Fi"],
    libraryYear: "1999",
    libraryWatched: "watching",
    libraryView: "list",
    librarySort: "az",
  };
  assert.equal((await send(t.app, "PATCH", "/api/settings", saved)).status, 200);
  const read = (await send(t.app, "GET", "/api/settings")).body;
  for (const [key, value] of Object.entries(saved)) assert.deepEqual(pick(read, `data.${key}`), value, key);
  await t.dispose();
});

test("an invalid library filter is refused whole, and a stored invalid one reads as its default", async () => {
  const t = await makeApp();
  const bad: Array<Record<string, unknown>> = [
    { libraryScope: "music" }, { librarySource: "collection:" }, { librarySource: "x" }, { libraryGenres: [""] },
    { libraryGenres: "Drama" }, { libraryYear: "99" }, { libraryYear: "abcd" }, { libraryWatched: "seen" },
  ];
  for (const patch of bad) {
    assert.equal((await send(t.app, "PATCH", "/api/settings", { libraryYear: "2001", ...patch })).status, 422);
  }
  const year = pick((await send(t.app, "GET", "/api/settings")).body, "data.libraryYear");
  assert.equal(year, "", "a refused patch commits nothing");
  const stored = new Map<string, unknown>([["libraryYear", "12"], ["libraryGenres", [3]], ["libraryScope", "tv"]]);
  const service = createSettingsService({
    repository: { readAll: () => stored, writeMany: () => undefined }, allowInsecureAdmin: false, now: () => 0,
  });
  assert.equal(service.get().libraryYear, "");
  assert.deepEqual(service.get().libraryGenres, []);
  assert.equal(service.get().libraryScope, "tv");
  await t.dispose();
});
