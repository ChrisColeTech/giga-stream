// Deleting a synced title keeps it deleted (docs/26 decision D20, docs/03 section 7.4): the stored copy goes, its TMDB
// identity is recorded, and browse, search, detail and the catalog sync skip it until it is restored. TMDB is a stub.
import assert from "node:assert/strict";
import test from "node:test";

import { itemsOf } from "./live-channel-kit.js";
import { pick, send } from "./test-app.js";
import { field, syncAll, titleApp } from "./title-edit-kit.js";
import { actionsOf } from "./title-soft-delete-kit.js";

const HOME = { kind: "movie", title: "Home Movie", year: 2020, genres: ["Drama"], rating: 7.5, plot: "Our holiday." };

test("a deleted synced title is recorded, and a re-sync does not bring it back", async () => {
  const h = await titleApp();
  const { t, token } = h;
  await syncAll(h);
  assert.equal((await send(t.app, "DELETE", "/api/admin/titles/movie-603", undefined, token)).status, 200);
  assert.equal((await send(t.app, "DELETE", "/api/admin/titles/movie-603", undefined, token)).status, 404, "nothing stored");

  h.tmdb.calls.length = 0;
  await syncAll(h);
  assert.ok(!h.tmdb.calls.includes("/movie/603"), "the sync did not fetch it");
  const status = await send(t.app, "GET", "/api/admin/titles/sync", undefined, token);
  assert.equal(pick(status.body, "data.titles"), 1, "only the series is stored: the deleted movie was not stored again");

  for (const url of ["/api/titles/movie-603", "/api/titles/movie-603?includeDisabled=true", "/api/titles/movie-603/recommendations"]) {
    const gone = await send(t.app, "GET", url, undefined, token);
    assert.deepEqual([gone.status, pick(gone.body, "error.code")], [404, "title.not_found"], url);
  }
});

test("the deleted list names the title and the time; a restore lets it return on the next browse and sync", async () => {
  const h = await titleApp();
  const { t, token } = h;
  await syncAll(h);
  await send(t.app, "DELETE", "/api/admin/titles/movie-603", undefined, token);
  const list = await send(t.app, "GET", "/api/admin/titles/deleted", undefined, token);
  assert.equal(list.status, 200);
  const now = h.t.clock.now();
  assert.deepEqual(pick(list.body, "data.items"), [{ id: "movie-603", kind: "movie", tmdbId: 603, title: "The Matrix", deletedAt: now }]);

  const restored = await send(t.app, "DELETE", "/api/admin/titles/deleted/movie-603", undefined, token);
  assert.deepEqual([restored.status, field(restored, "id")], [200, "movie-603"]);
  assert.deepEqual(pick((await send(t.app, "GET", "/api/admin/titles/deleted", undefined, token)).body, "data.items"), []);
  assert.equal((await send(t.app, "DELETE", "/api/admin/titles/deleted/movie-603", undefined, token)).status, 404, "already restored");
  assert.equal((await send(t.app, "GET", "/api/titles/movie-603")).status, 404, "restoring stores nothing: the next sync does");
  await syncAll(h);
  assert.equal(pick((await send(t.app, "GET", "/api/admin/titles/sync", undefined, token)).body, "data.titles"), 2, "the Library fill walks both kinds: the restored movie and the series");
  assert.equal((await send(t.app, "GET", "/api/titles/movie-603")).status, 200);
});

test("a title made by hand is deleted for real: nothing is recorded, and the audit log names each step", async () => {
  const h = await titleApp();
  const { t, token } = h;
  const id = String(field(await send(t.app, "POST", "/api/admin/titles", HOME, token), "id"));
  assert.equal((await send(t.app, "DELETE", `/api/admin/titles/${id}`, undefined, token)).status, 200);
  assert.deepEqual(pick((await send(t.app, "GET", "/api/admin/titles/deleted", undefined, token)).body, "data.items"), []);
  assert.equal((await send(t.app, "DELETE", `/api/admin/titles/deleted/${id}`, undefined, token)).status, 404);

  await syncAll(h);
  await send(t.app, "DELETE", "/api/admin/titles/movie-603", undefined, token);
  await send(t.app, "DELETE", "/api/admin/titles/deleted/movie-603", undefined, token);
  const audit = await actionsOf(t, token);
  assert.deepEqual(audit.filter((a) => a.startsWith("title.")), ["title.restored", "title.deleted", "title.deleted", "title.created"]);
});

test("the deleted routes need a sign-in and are never cached", async () => {
  const { t, token } = await titleApp();
  for (const [method, url] of [["GET", "/api/admin/titles/deleted"], ["DELETE", "/api/admin/titles/deleted/movie-603"]] as const) {
    for (const bad of [undefined, "not-a-token"]) {
      const answer = await send(t.app, method, url, undefined, bad);
      assert.deepEqual([answer.status, pick(answer.body, "error.code")], [401, "auth.unauthorized"], `${method} ${url}`);
      assert.equal(answer.headers["cache-control"], "no-store", `${method} ${url} unauthorised`);
    }
  }
  const list = await send(t.app, "GET", "/api/admin/titles/deleted", undefined, token);
  assert.equal(list.headers["cache-control"], "no-store");
});

test("a deleted title is out of Browse TMDB's way: its row says deleted, and the public reads and the catalog skip it", async () => {
  const h = await titleApp();
  const { t, token } = h;
  await syncAll(h);
  await send(t.app, "DELETE", "/api/admin/titles/movie-603", undefined, token);
  const browse = await send(t.app, "GET", "/api/admin/tmdb/titles?kind=movie", undefined, token);
  assert.deepEqual([field(browse, "items.0.deleted"), field(browse, "items.0.stored")], [true, false]);
  assert.deepEqual(itemsOf((await send(t.app, "GET", "/api/titles/catalog")).body).map((i) => i.id), ["tv-1399"]);
  assert.equal((await send(t.app, "GET", "/api/titles/movie-603")).status, 404);
});
