// Deleting a synced title keeps it deleted (docs/26 decision D20, docs/03 section 7.4): the stored copy goes, its TMDB
// identity is recorded, and browse, search, detail and the catalog sync skip it until it is restored. TMDB is a stub.
import assert from "node:assert/strict";
import test from "node:test";

import { itemsOf } from "./live-channel-kit.js";
import { makeApp, pick, send, signIn } from "./test-app.js";
import { field, syncAll, titleApp } from "./title-edit-kit.js";
import { actionsOf, pagedTmdb } from "./title-soft-delete-kit.js";

const HOME = { kind: "movie", title: "Home Movie", year: 2020, genres: ["Drama"], rating: 7.5, plot: "Our holiday." };

test("a deleted synced title is recorded, and a re-sync and a re-browse do not bring it back", async () => {
  const h = await titleApp();
  const { t, token } = h;
  await syncAll(h, { scope: "trending", kind: "movie", pages: 1 });
  assert.equal((await send(t.app, "DELETE", "/api/titles/movie-603", undefined, token)).status, 200);
  assert.equal((await send(t.app, "DELETE", "/api/titles/movie-603", undefined, token)).status, 404, "nothing stored");

  h.tmdb.calls.length = 0;
  await syncAll(h, { scope: "trending", kind: "movie", pages: 1 });
  await syncAll(h, { scope: "titles", ids: ["movie-603"] });
  const browse = await send(t.app, "GET", "/api/titles?kind=movie");
  assert.deepEqual([browse.status, itemsOf(browse.body).length, field(browse, "skipped")], [200, 0, 1]);
  const search = await send(t.app, "GET", "/api/titles/search?kind=movie&q=matrix");
  assert.deepEqual([itemsOf(search.body).length, field(search, "skipped")], [0, 1]);
  assert.ok(!h.tmdb.calls.includes("/movie/603"), "the sync did not fetch it");
  const status = await send(t.app, "GET", "/api/titles/sync", undefined, token);
  assert.equal(pick(status.body, "data.titles"), 0, "nothing was stored again");

  for (const url of ["/api/titles/movie-603", "/api/titles/movie-603?includeDisabled=true", "/api/titles/movie-603/recommendations"]) {
    const gone = await send(t.app, "GET", url, undefined, token);
    assert.deepEqual([gone.status, pick(gone.body, "error.code")], [404, "title.not_found"], url);
  }
});

test("the deleted list names the title and the time; a restore lets it return on the next browse and sync", async () => {
  const h = await titleApp();
  const { t, token } = h;
  await syncAll(h, { scope: "trending", kind: "movie", pages: 1 });
  await send(t.app, "DELETE", "/api/titles/movie-603", undefined, token);
  const list = await send(t.app, "GET", "/api/titles/deleted", undefined, token);
  assert.equal(list.status, 200);
  const now = h.t.clock.now();
  assert.deepEqual(pick(list.body, "data.items"), [{ id: "movie-603", kind: "movie", tmdbId: 603, title: "The Matrix", deletedAt: now }]);

  const restored = await send(t.app, "DELETE", "/api/titles/deleted/movie-603", undefined, token);
  assert.deepEqual([restored.status, field(restored, "id")], [200, "movie-603"]);
  assert.deepEqual(pick((await send(t.app, "GET", "/api/titles/deleted", undefined, token)).body, "data.items"), []);
  assert.equal((await send(t.app, "DELETE", "/api/titles/deleted/movie-603", undefined, token)).status, 404, "already restored");
  const browse = await send(t.app, "GET", "/api/titles?kind=movie");
  assert.deepEqual(itemsOf(browse.body).map((i) => i.title), ["The Matrix"]);
  await syncAll(h, { scope: "trending", kind: "movie", pages: 1 });
  assert.equal(pick((await send(t.app, "GET", "/api/titles/sync", undefined, token)).body, "data.titles"), 1);
  assert.equal((await send(t.app, "GET", "/api/titles/movie-603")).status, 200);
});

test("a title made by hand is deleted for real: nothing is recorded, and the audit log names each step", async () => {
  const h = await titleApp();
  const { t, token } = h;
  const id = String(field(await send(t.app, "POST", "/api/titles", HOME, token), "id"));
  assert.equal((await send(t.app, "DELETE", `/api/titles/${id}`, undefined, token)).status, 200);
  assert.deepEqual(pick((await send(t.app, "GET", "/api/titles/deleted", undefined, token)).body, "data.items"), []);
  assert.equal((await send(t.app, "DELETE", `/api/titles/deleted/${id}`, undefined, token)).status, 404);

  await syncAll(h, { scope: "trending", kind: "movie", pages: 1 });
  await send(t.app, "DELETE", "/api/titles/movie-603", undefined, token);
  await send(t.app, "DELETE", "/api/titles/deleted/movie-603", undefined, token);
  const audit = await actionsOf(t, token);
  assert.deepEqual(audit.filter((a) => a.startsWith("title.")), ["title.restored", "title.deleted", "title.deleted", "title.created"]);
});

test("the deleted routes need a sign-in and are never cached", async () => {
  const { t, token } = await titleApp();
  for (const [method, url] of [["GET", "/api/titles/deleted"], ["DELETE", "/api/titles/deleted/movie-603"]] as const) {
    for (const bad of [undefined, "not-a-token"]) {
      const answer = await send(t.app, method, url, undefined, bad);
      assert.deepEqual([answer.status, pick(answer.body, "error.code")], [401, "auth.unauthorized"], `${method} ${url}`);
      assert.equal(answer.headers["cache-control"], "no-store", `${method} ${url} unauthorised`);
    }
  }
  const list = await send(t.app, "GET", "/api/titles/deleted", undefined, token);
  assert.equal(list.headers["cache-control"], "no-store");
});

test("paging stays full: a page the deleted titles thin says how many it left out, and the list holds its place", async () => {
  const tmdb = await pagedTmdb();
  const t = await makeApp({ config: { TMDB_READ_TOKEN: "test-token", TMDB_BASE: tmdb.base } });
  const token = (await signIn(t.app)).access;
  const titles = async (page: number) => {
    const answer = await send(t.app, "GET", `/api/titles?kind=movie&sort=az&page=${page}`);
    return { names: itemsOf(answer.body).map((i) => i.title), skipped: field(answer, "skipped"), pages: field(answer, "totalPages") };
  };
  assert.deepEqual(await titles(1), { names: ["A1", "A2", "A3"], skipped: 0, pages: 3 });
  for (const id of ["movie-101", "movie-102"]) await send(t.app, "DELETE", `/api/titles/${id}`, undefined, token);
  // The page keeps its place (page 2 is still TMDB's page 2) and says it was thinned, so a reader refills from the next.
  assert.deepEqual(await titles(1), { names: ["A3"], skipped: 2, pages: 3 }, "from the stored list");
  assert.deepEqual(await titles(2), { names: ["B1", "B2", "B3"], skipped: 0, pages: 3 });
  const before = tmdb.calls.filter((c) => c === "/discover/movie").length;
  await titles(1);
  assert.equal(tmdb.calls.filter((c) => c === "/discover/movie").length, before, "the stored list still serves page 1");
  await send(t.app, "DELETE", "/api/titles/deleted/movie-101", undefined, token);
  assert.deepEqual((await titles(1)).names, ["A1", "A3"], "restored: back on the next browse");
});
