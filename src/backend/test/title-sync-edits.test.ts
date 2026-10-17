// The one rule for titles (docs/26 section 3.10, rule 1): a sync, a stale read and the healing refetch merge TMDB's
// payload under the fields an admin edited and never overwrite them; a title made by hand is never touched.
import assert from "node:assert/strict";
import test from "node:test";

import { later, FOUR_DAYS_MS, field, syncAll, titleApp } from "./title-edit-kit.js";
import { pick, send } from "./test-app.js";

const SYNC_MOVIES = { scope: "trending", kind: "movie", pages: 1 };

test("an edited plot survives a bulk sync of a stale entry, the healing refetch and a stale read; the rest refreshes", async () => {
  const h = await titleApp();
  await syncAll(h, SYNC_MOVIES);
  let token = await later(h, 0);
  assert.equal(field(await send(h.t.app, "GET", "/api/titles/movie-603"), "plot"), "TMDB plot v1");
  const patched = await send(h.t.app, "PATCH", "/api/titles/movie-603", { plot: "My plot", rating: 5 }, token);
  assert.deepEqual([patched.status, field(patched, "plot"), field(patched, "rating"), field(patched, "state")], [200, "My plot", 5, "edited"]);

  // TMDB moves on and the stored copy goes stale.
  Object.assign(h.tmdb.state, { title: "The Matrix Reloaded", plot: "TMDB plot v2", rating: 9.1, runtime: 150 });
  token = await later(h, FOUR_DAYS_MS);

  // 1. A bulk sync replaces the stale entry with TMDB's thin row, under the edits.
  await syncAll(h, SYNC_MOVIES);
  const browse = await send(h.t.app, "GET", "/api/titles?kind=movie&sort=newest");
  assert.deepEqual(
    ["title", "rating", "plot", "state"].map((f) => pick(browse.body, `data.items.0.${f}`)),
    ["The Matrix Reloaded", 5, "My plot", "edited"],
    "the title (not edited) is TMDB's new one; the rating and plot are the admin's",
  );

  // 2. The read that heals the thin row refetches the detail, under the edits.
  const healed = await send(h.t.app, "GET", "/api/titles/movie-603");
  assert.deepEqual(
    ["title", "plot", "rating", "runtimeMs", "state"].map((f) => field(healed, f)),
    ["The Matrix Reloaded", "My plot", 5, 150 * 60_000, "edited"],
  );

  // 3. A stale read refetches the detail, under the edits.
  h.tmdb.state.runtime = 160;
  await later(h, FOUR_DAYS_MS);
  const stale = await send(h.t.app, "GET", "/api/titles/movie-603");
  assert.deepEqual([field(stale, "plot"), field(stale, "rating"), field(stale, "runtimeMs")], ["My plot", 5, 160 * 60_000]);

  // Revert drops the edits and takes TMDB's record again.
  const reverted = await send(h.t.app, "POST", "/api/titles/movie-603/revert", undefined, await later(h, 0));
  assert.deepEqual(
    [reverted.status, field(reverted, "plot"), field(reverted, "rating"), field(reverted, "state")],
    [200, "TMDB plot v2", 9.1, "synced"],
  );
  assert.equal(field(await send(h.t.app, "GET", "/api/titles/movie-603"), "state"), "synced");
});

test("an edit that clears a field stays cleared through a sync", async () => {
  const h = await titleApp();
  await syncAll(h, SYNC_MOVIES);
  await send(h.t.app, "GET", "/api/titles/movie-603");
  const cleared = await send(h.t.app, "PATCH", "/api/titles/movie-603", { plot: null }, h.token);
  assert.equal(field(cleared, "plot"), undefined);
  await later(h, FOUR_DAYS_MS);
  await syncAll(h, SYNC_MOVIES);
  assert.equal(field(await send(h.t.app, "GET", "/api/titles/movie-603"), "plot"), undefined);
});

test("the explicit ids scope takes title ids and fetches a series as a series", async () => {
  const h = await titleApp();
  await syncAll(h, { scope: "titles", ids: ["tv-1399", "movie-603"] });
  assert.ok(h.tmdb.calls.includes("/tv/1399"));
  assert.equal(h.tmdb.calls.includes("/movie/1399"), false, "a series id is not fetched as a movie");
  assert.ok(h.tmdb.calls.includes("/movie/603"));
  const token = await later(h, 0);
  for (const ids of [[603], ["603"], ["show-1"], ["movie-0"]]) {
    const refused = await send(h.t.app, "POST", "/api/titles/sync", { scope: "titles", ids }, token);
    assert.deepEqual([refused.status, pick(refused.body, "error.code")], [422, "sync.invalid"], JSON.stringify(ids));
  }
  assert.equal(field(await send(h.t.app, "GET", "/api/titles/tv-1399"), "title"), "Game of Thrones");
});

test("a title made by hand is never touched by a sync, even with a TMDB id of its own", async () => {
  const h = await titleApp();
  const made = await send(h.t.app, "POST", "/api/titles", { kind: "movie", title: "My Matrix", tmdbId: 603, plot: "Mine" }, h.token);
  const id = String(field(made, "id"));
  await syncAll(h, SYNC_MOVIES);
  await send(h.t.app, "GET", "/api/titles/movie-603");
  await later(h, FOUR_DAYS_MS);
  await syncAll(h, SYNC_MOVIES);
  const mine = await send(h.t.app, "GET", `/api/titles/${id}`);
  assert.deepEqual([field(mine, "title"), field(mine, "plot"), field(mine, "state")], ["My Matrix", "Mine", "manual"]);
  assert.equal(field(await send(h.t.app, "GET", "/api/titles/movie-603"), "title"), "The Matrix");
});

test("a title an admin deleted is skipped by the sync, by id, by the read and by the healing refetch", async () => {
  const h = await titleApp();
  await syncAll(h, SYNC_MOVIES);
  await send(h.t.app, "GET", "/api/titles/movie-603");
  assert.equal((await send(h.t.app, "DELETE", "/api/titles/movie-603", undefined, h.token)).status, 200);
  h.tmdb.calls.length = 0;
  await later(h, FOUR_DAYS_MS);
  await syncAll(h, SYNC_MOVIES);
  await syncAll(h, { scope: "titles", ids: ["movie-603"] });
  assert.equal(h.tmdb.calls.includes("/movie/603"), false, "the ids scope did not fetch it");
  const gone = await send(h.t.app, "GET", "/api/titles/movie-603");
  assert.deepEqual([gone.status, pick(gone.body, "error.code")], [404, "title.not_found"]);
  assert.equal(h.tmdb.calls.includes("/movie/603"), false, "the read did not fetch it");
  const browse = await send(h.t.app, "GET", "/api/titles?kind=movie&sort=newest");
  assert.equal((pick(browse.body, "data.items") as unknown[]).length, 0);
  const search = await send(h.t.app, "GET", "/api/titles/search?kind=movie&q=matrix");
  assert.equal((pick(search.body, "data.items") as unknown[]).length, 0);
});
