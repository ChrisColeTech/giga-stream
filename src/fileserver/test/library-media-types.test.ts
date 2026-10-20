import assert from "node:assert/strict";
import test from "node:test";

import { pick, send } from "./app-fixture.js";
import type { FakeTitle } from "./fake-titles.js";
import { bootTitles, idsOf, localFile, syncTitles } from "./library-fixture.js";

const TITLES: FakeTitle[] = [
  { id: "movie-1", kind: "movie", title: "Movie" },
  { id: "tv-1", kind: "tv", title: "TV" },
];
const COMBINATIONS = [
  { types: ["movie"], ids: ["movie-1"] },
  { types: ["tv"], ids: ["tv-1"] },
  { types: ["local"], ids: ["local-1"] },
  { types: ["movie", "tv"], ids: ["movie-1", "tv-1"] },
  { types: ["movie", "local"], ids: ["local-1", "movie-1"] },
  { types: ["tv", "local"], ids: ["local-1", "tv-1"] },
  { types: ["movie", "tv", "local"], ids: ["local-1", "movie-1", "tv-1"] },
] as const;

const typeQuery = (types: readonly string[]): string => types.map((type) => `type=${type}`).join("&");
const sortedIds = (body: unknown): string[] => idsOf(body).sort();

test("all, history, favorites and collections honor every canonical media combination", async () => {
  const { t } = await bootTitles(TITLES);
  await syncTitles(t);
  const made = await send(t.app, "POST", "/api/collections", { name: "Mixed", type: "local" });
  const collectionId = String(pick(made.body, "data.id"));
  const localId = localFile(t, "Local.mkv", { collectionId });
  await send(t.app, "PUT", `/api/collections/${collectionId}/items`, { kind: "title", id: "movie-1" });
  await send(t.app, "PUT", `/api/collections/${collectionId}/items`, { kind: "title", id: "tv-1" });
  for (const id of ["movie-1", "tv-1"]) await send(t.app, "PUT", `/api/favorites/title/${id}`);
  await send(t.app, "PUT", `/api/favorites/local/${localId}`);
  for (const [index, item] of [
    { kind: "title", id: "movie-1" },
    { kind: "title", id: "tv-1" },
    { kind: "local", id: localId },
  ].entries()) {
    await send(t.app, "PUT", "/api/watch", { item, positionMs: 1, playbackId: `p${index}`, seq: 1 });
  }

  const views = ["", "view=history&", "view=favorites&", `view=collection&collectionId=${collectionId}&`];
  for (const combination of COMBINATIONS) {
    const expected = combination.ids.map((id) => (id === "local-1" ? localId : id)).sort();
    for (const view of views) {
      const page = await send(t.app, "GET", `/api/library?${view}${typeQuery(combination.types)}&sort=az`);
      assert.equal(page.status, 200, `${view}${typeQuery(combination.types)}`);
      assert.deepEqual(sortedIds(page.body), expected, `${view}${typeQuery(combination.types)}`);
    }
  }
  await t.dispose();
});

test("the HTTP boundary accepts legacy and repeated media forms and refuses empty or unknown values", async () => {
  const { t } = await bootTitles(TITLES);
  await syncTitles(t);
  const localId = localFile(t, "Local.mkv");
  const all = [localId, "movie-1", "tv-1"].sort();
  const cases: Array<[string, string[]]> = [
    ["", all],
    ["type=all", all],
    ["type=movie", ["movie-1"]],
    ["type=tv&type=movie&type=tv", ["movie-1", "tv-1"]],
    ["type=local&type=all&type=movie", all],
  ];
  for (const [query, expected] of cases) {
    const page = await send(t.app, "GET", `/api/library${query === "" ? "" : `?${query}`}`);
    assert.deepEqual(sortedIds(page.body), expected, query || "absent");
  }
  for (const query of ["type=", "type=music", "type=movie&type="]) {
    const refused = await send(t.app, "GET", `/api/library?${query}`);
    assert.equal(refused.status, 422, query);
    assert.equal(pick(refused.body, "error.code"), "library.invalid", query);
  }
  await t.dispose();
});

test("mixed local and title media still return locals when an empty title cache is unavailable", async () => {
  const { backend, t } = await bootTitles(TITLES);
  backend.state.down = true;
  const localId = localFile(t, "Offline.mkv");
  const page = await send(t.app, "GET", "/api/library?type=movie&type=local");
  assert.equal(page.status, 200);
  assert.deepEqual(idsOf(page.body), [localId]);
  assert.equal(pick(page.body, "data.titlesAvailable"), false);
  await t.dispose();
});
