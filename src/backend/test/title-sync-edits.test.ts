// The one rule for titles (docs/26 section 3.10, rule 1): a sync (the walk and the details phase) and a revert merge
// TMDB's payload under the fields an admin edited and never overwrite them; a title made by hand is never touched.
import assert from "node:assert/strict";
import test from "node:test";

import { later, FOUR_DAYS_MS, field, syncAll, titleApp } from "./title-edit-kit.js";
import { pick, send } from "./test-app.js";

test("an edited plot survives a bulk sync of a stale entry; the rest refreshes; a revert takes TMDB's record again", async () => {
  const h = await titleApp();
  await syncAll(h);
  let token = await later(h, 0);
  assert.equal(field(await send(h.t.app, "GET", "/api/titles/movie-603"), "plot"), "TMDB plot v1", "the sync stored the detail");
  const patched = await send(h.t.app, "PATCH", "/api/admin/titles/movie-603", { plot: "My plot", rating: 5 }, token);
  assert.deepEqual([patched.status, field(patched, "plot"), field(patched, "rating"), field(patched, "state")], [200, "My plot", 5, "edited"]);

  // TMDB moves on and the stored copy goes stale: the next Library fill's details phase fetches it again, under the edits.
  Object.assign(h.tmdb.state, { title: "The Matrix Reloaded", plot: "TMDB plot v2", rating: 9.1, runtime: 150 });
  token = await later(h, FOUR_DAYS_MS);
  await syncAll(h);
  const healed = await send(h.t.app, "GET", "/api/titles/movie-603");
  assert.deepEqual(
    ["title", "plot", "rating", "runtimeMs", "state"].map((f) => field(healed, f)),
    ["The Matrix Reloaded", "My plot", 5, 150 * 60_000, "edited"],
  );

  // Revert drops the edits and takes TMDB's record again.
  const reverted = await send(h.t.app, "POST", "/api/admin/titles/movie-603/revert", undefined, await later(h, 0));
  assert.deepEqual(
    [reverted.status, field(reverted, "plot"), field(reverted, "rating"), field(reverted, "state")],
    [200, "TMDB plot v2", 9.1, "synced"],
  );
  assert.equal(field(await send(h.t.app, "GET", "/api/titles/movie-603"), "state"), "synced");
});

test("an edit that clears a field stays cleared through a sync", async () => {
  const h = await titleApp();
  await syncAll(h);
  const cleared = await send(h.t.app, "PATCH", "/api/admin/titles/movie-603", { plot: null }, h.token);
  assert.equal(field(cleared, "plot"), undefined);
  await later(h, FOUR_DAYS_MS);
  await syncAll(h);
  assert.equal(field(await send(h.t.app, "GET", "/api/titles/movie-603"), "plot"), undefined);
});

test("POST /api/admin/titles/sync starts the Library fill, which walks both kinds, and takes no settings of its own", async () => {
  const h = await titleApp();
  await syncAll(h);
  assert.ok(h.tmdb.calls.includes("/discover/movie") && h.tmdb.calls.includes("/discover/tv"));
  assert.equal(h.tmdb.calls.some((call) => call.startsWith("/trending/")), false, "the discover walk, not a list");
  const token = await later(h, 0);
  for (const body of [{ scope: "trending", kind: "movie", pages: 1 }, { scope: "titles", ids: ["movie-603"] }, { pages: 3 }]) {
    const refused = await send(h.t.app, "POST", "/api/admin/titles/sync", body, token);
    assert.deepEqual([refused.status, pick(refused.body, "error.code")], [422, "sync.invalid"], JSON.stringify(body));
  }
  assert.equal(field(await send(h.t.app, "GET", "/api/titles/tv-1399"), "title"), "Game of Thrones");
});

test("a title made by hand is never touched by a sync, even with a TMDB id of its own", async () => {
  const h = await titleApp();
  const made = await send(h.t.app, "POST", "/api/admin/titles", { kind: "movie", title: "My Matrix", tmdbId: 603, plot: "Mine" }, h.token);
  const id = String(field(made, "id"));
  await syncAll(h);
  await later(h, FOUR_DAYS_MS);
  await syncAll(h);
  const mine = await send(h.t.app, "GET", `/api/titles/${id}`);
  assert.deepEqual([field(mine, "title"), field(mine, "plot"), field(mine, "state")], ["My Matrix", "Mine", "manual"]);
  assert.equal(field(await send(h.t.app, "GET", "/api/titles/movie-603"), "title"), "The Matrix");
});

test("a deleted synced title stays out of a sync until it is restored, then comes back as a plain synced one", async () => {
  const h = await titleApp();
  await syncAll(h);
  await send(h.t.app, "PATCH", "/api/admin/titles/movie-603", { plot: "Mine" }, h.token);
  assert.equal((await send(h.t.app, "DELETE", "/api/admin/titles/movie-603", undefined, h.token)).status, 200);
  await syncAll(h);
  assert.equal((await send(h.t.app, "GET", "/api/titles/movie-603")).status, 404, "still deleted");
  assert.equal((await send(h.t.app, "DELETE", "/api/admin/titles/deleted/movie-603", undefined, h.token)).status, 200);
  await syncAll(h);
  const back = await send(h.t.app, "GET", "/api/titles/movie-603");
  assert.deepEqual(["title", "state", "shape"].map((f) => field(back, f)), ["The Matrix", "synced", "detail"]);
});
