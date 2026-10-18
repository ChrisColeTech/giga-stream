// Browse TMDB (docs/47 section 3.3): the admin-only routes read TMDB and write nothing, and say per row whether the
// store holds it or has it deleted; an add is the explicit POST /api/titles/from-tmdb.
import assert from "node:assert/strict";
import test from "node:test";

import { makeApp, pick, send, signIn } from "./test-app.js";
import { stubTmdb, tmdbOn } from "./title-stubs.js";

async function setup() {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: tmdbOn(tmdb) });
  const token = (await signIn(t.app)).access;
  const stored = async (): Promise<unknown> => pick((await send(t.app, "GET", "/api/titles/stored?limit=1", undefined, token)).body, "data.total");
  return { tmdb, t, token, stored };
}

test("both routes need a sign-in and answer no-store", async () => {
  const { t, token } = await setup();
  for (const url of ["/api/admin/tmdb/titles?kind=movie", "/api/admin/tmdb/search?kind=movie&q=matrix"]) {
    for (const bad of [undefined, "not-a-token"]) {
      const refused = await send(t.app, "GET", url, undefined, bad);
      assert.deepEqual([refused.status, pick(refused.body, "error.code")], [401, "auth.unauthorized"], url);
    }
    const answered = await send(t.app, "GET", url, undefined, token);
    assert.deepEqual([answered.status, answered.headers["cache-control"]], [200, "no-store"], url);
  }
  assert.equal((await send(t.app, "POST", "/api/titles/from-tmdb", { id: "movie-603" })).status, 401);
});

test("browse and search show TMDB's rows with stored and deleted, and write nothing to the store", async () => {
  const { tmdb, t, token, stored } = await setup();
  assert.equal(await stored(), 0);
  const browse = await send(t.app, "GET", "/api/admin/tmdb/titles?kind=all&sort=trending&page=1", undefined, token);
  assert.deepEqual(
    ["items.0.id", "items.0.title", "items.0.state", "items.0.stored", "items.0.deleted", "page", "totalPages", "totalResults", "skipped"]
      .map((f) => pick(browse.body, `data.${f}`)),
    ["movie-603", "The Matrix", "synced", false, false, 1, 1, 2, 0],
  );
  assert.equal(pick(browse.body, "data.items.1.id"), "tv-1399");
  const search = await send(t.app, "GET", "/api/admin/tmdb/search?kind=movie&q=matrix", undefined, token);
  assert.deepEqual(["items.0.id", "items.0.stored", "totalResults"].map((f) => pick(search.body, `data.${f}`)), ["movie-603", false, 1]);
  assert.ok(tmdb.calls.some((c) => c.startsWith("/search/movie?") && c.includes("query=matrix")));
  assert.equal(await stored(), 0, "reading TMDB stores nothing");
  assert.equal((await send(t.app, "GET", "/api/titles/movie-603")).status, 404);

  // Added explicitly, the row says stored; deleted, it says deleted.
  assert.equal((await send(t.app, "POST", "/api/titles/from-tmdb", { id: "movie-603" }, token)).status, 201);
  const after = await send(t.app, "GET", "/api/admin/tmdb/titles?kind=movie", undefined, token);
  assert.deepEqual([pick(after.body, "data.items.0.stored"), pick(after.body, "data.items.0.deleted")], [true, false]);
  await send(t.app, "DELETE", "/api/titles/movie-603", undefined, token);
  const gone = await send(t.app, "GET", "/api/admin/tmdb/titles?kind=movie", undefined, token);
  assert.deepEqual([pick(gone.body, "data.items.0.stored"), pick(gone.body, "data.items.0.deleted")], [false, true]);
  assert.equal(await stored(), 0);
});

test("a series browse uses the series' date, name and year parameters; a bad query is refused", async () => {
  const { tmdb, t, token } = await setup();
  for (const [sort, expected] of [["newest", "first_air_date.desc"], ["az", "name.asc"]]) {
    await send(t.app, "GET", `/api/admin/tmdb/titles?kind=tv&sort=${sort}&year=2020&page=1`, undefined, token);
    const request = new URL(tmdb.calls.filter((c) => c.startsWith("/discover/tv")).at(-1) ?? "", tmdb.base);
    assert.equal(request.searchParams.get("sort_by"), expected);
    assert.equal(request.searchParams.get("first_air_date_year"), "2020");
    assert.equal(request.searchParams.get("vote_count.gte"), "50");
  }
  for (const url of ["/api/admin/tmdb/search?kind=movie", "/api/admin/tmdb/titles?sort=sideways", "/api/admin/tmdb/titles?page=0"]) {
    assert.deepEqual([(await send(t.app, "GET", url, undefined, token)).status], [400], url);
  }
});

test("TMDB out of reach is 503 tmdb.unavailable, never a stored answer", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  for (const url of ["/api/admin/tmdb/titles", "/api/admin/tmdb/search?q=matrix"]) {
    const answer = await send(t.app, "GET", url, undefined, token);
    assert.deepEqual([answer.status, pick(answer.body, "error.code")], [503, "tmdb.unavailable"], url);
  }
  const down = await makeApp({ config: { TMDB_READ_TOKEN: "t", TMDB_BASE: "http://127.0.0.1:1" } });
  const answer = await send(down.app, "GET", "/api/admin/tmdb/titles", undefined, (await signIn(down.app)).access);
  assert.deepEqual([answer.status, pick(answer.body, "error.code")], [503, "tmdb.unavailable"]);
});

test("POST /api/titles/from-tmdb fetches one title, stores it, audits title.created; 409 when taken, 422 for a bad id", async () => {
  const { tmdb, t, token, stored } = await setup();
  const added = await send(t.app, "POST", "/api/titles/from-tmdb", { id: "tv-1399" }, token);
  assert.equal(added.status, 201);
  assert.deepEqual(["id", "shape", "state", "title", "seasons.0.episodeCount"].map((f) => pick(added.body, `data.${f}`)),
    ["tv-1399", "detail", "synced", "Game of Thrones", 10]);
  assert.equal(await stored(), 1);
  assert.equal(pick((await send(t.app, "GET", "/api/titles/tv-1399/seasons/1")).body, "data.episodes.0.title"), "Winter Is Coming");
  const entry = (pick((await send(t.app, "GET", "/api/audit?limit=5", undefined, token)).body, "data.items") as Array<Record<string, unknown>>)[0];
  assert.deepEqual([entry?.action, entry?.subject], ["title.created", "tv-1399"]);
  const calls = tmdb.calls.length;

  const again = await send(t.app, "POST", "/api/titles/from-tmdb", { id: "tv-1399" }, token);
  assert.deepEqual([again.status, pick(again.body, "error.code")], [409, "title.taken"]);
  await send(t.app, "DELETE", "/api/titles/tv-1399", undefined, token);
  assert.equal((await send(t.app, "POST", "/api/titles/from-tmdb", { id: "tv-1399" }, token)).status, 409, "deleted: restore it instead");
  assert.equal(tmdb.calls.length, calls, "a refused add asks TMDB nothing");
  for (const body of [{ id: "movie-0" }, { id: "custom-1" }, { id: "movie-603", extra: 1 }, {}, { id: 603 }]) {
    const bad = await send(t.app, "POST", "/api/titles/from-tmdb", body, token);
    assert.deepEqual([bad.status, pick(bad.body, "error.code")], [422, "title.invalid"], JSON.stringify(body));
  }
  assert.equal((await send(t.app, "POST", "/api/titles/from-tmdb", { id: "movie-999999" }, token)).status, 404, "TMDB does not know it");
});
