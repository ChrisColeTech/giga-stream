import assert from "node:assert/strict";
import test from "node:test";

import { CACHE_WINDOW_MS, CATALOG_PAGE_SIZE } from "../src/constants/backend-cache.js";
import { pick, send } from "./app-fixture.js";
import { FAKE_ADMIN_URL } from "./fake-backend.js";
import type { FakeTitle } from "./fake-titles.js";
import { bootTitles, idsOf, peek, syncTitles } from "./library-fixture.js";

const FIVE: FakeTitle[] = [
  { id: "movie-1", title: "Alien", year: 1979, popularity: 50, genres: ["878", "28"] },
  { id: "movie-2", title: "Blade", year: 1998, popularity: 40, genres: ["28", "999999"] },
  { id: "movie-3", title: "Casablanca", year: 1942, genres: ["Romance"] },
  { id: "tv-1", title: "Dark", year: 2017, popularity: 30, genres: ["18"] },
  { id: "tv-2", title: "Eureka", year: 2006, genres: ["35"] },
];

const state = (t: Parameters<typeof peek>[0]) => peek(t, "SELECT * FROM cache_state WHERE dataset = 'titles'")[0];
const ids = (t: Parameters<typeof peek>[0]) => peek(t, "SELECT id FROM cached_titles ORDER BY id").map((row) => row.id);

test("a cold 3-page walk decodes genres: the dictionary first, then 500-row pages after the last id", async () => {
  const { backend, t } = await bootTitles(FIVE, { pageSize: 2 });
  const refreshed = await syncTitles(t);
  assert.equal(refreshed.status, 200);
  assert.equal(pick(refreshed.body, "data.titlesAvailable"), true);

  assert.deepEqual(backend.genreCalls().map((call) => new URL(call.url).searchParams.get("kind")), ["movie", "tv"]);
  const walk = backend.catalogCalls().map((call) => new URL(call.url).searchParams);
  assert.deepEqual(walk.map((q) => q.get("after")), [null, "movie-2", "tv-1"], "each page asks after the last id");
  assert.ok(walk.every((q) => q.get("limit") === String(CATALOG_PAGE_SIZE)));

  const genres = peek(t, "SELECT title_id, genre FROM cached_title_genres ORDER BY title_id, genre").map((r) => `${r.title_id}:${r.genre}`);
  assert.deepEqual(genres, [
    "movie-1:Action", "movie-1:Science Fiction", "movie-2:Action", "movie-3:Romance", "tv-1:Drama", "tv-2:Comedy",
  ], "ids decode per kind, a name stays, an unknown numeric id is dropped");
  assert.deepEqual(ids(t), ["movie-1", "movie-2", "movie-3", "tv-1", "tv-2"]);
  const row = state(t);
  assert.equal(row?.run, 1);
  assert.equal(row?.error_code, null);
  assert.notEqual(row?.synced_at, null);
  await t.dispose();
});

test("a title the catalog no longer lists is swept; an edit is upserted and the opened detail survives it", async () => {
  const { backend, t } = await bootTitles(FIVE, { pageSize: 2 });
  await syncTitles(t);
  backend.state.details["movie-1"] = { id: "movie-1", kind: "movie", title: "Alien", year: 1979, genres: ["Action"], plot: "In space." };
  await send(t.app, "GET", "/api/titles/movie-1");

  const [first, ...rest] = FIVE;
  backend.publish([{ ...(first as FakeTitle), title: "Alien (Director's Cut)", year: 1980 }, ...rest.filter((one) => one.id !== "movie-3")]);
  t.clock.advance(1_000);
  assert.equal((await syncTitles(t)).status, 200);

  assert.deepEqual(ids(t), ["movie-1", "movie-2", "tv-1", "tv-2"], "movie-3 was swept");
  assert.deepEqual(peek(t, "SELECT genre FROM cached_title_genres WHERE title_id = 'movie-3'"), [], "its genre rows went with it");
  const edited = peek(t, "SELECT title, year, plot, in_catalog, seen_run FROM cached_titles WHERE id = 'movie-1'")[0];
  assert.deepEqual(edited, { title: "Alien (Director's Cut)", year: 1980, plot: "In space.", in_catalog: 1, seen_run: 2 });
  assert.equal(state(t)?.run, 2);
  await t.dispose();
});

test("a failure mid-walk keeps the cache: no sweep, synced_at unchanged, only the error code", async () => {
  const { backend, t } = await bootTitles(FIVE, { pageSize: 2 });
  await syncTitles(t);
  const before = state(t);

  backend.publish(FIVE.filter((one) => one.id !== "movie-3"));
  backend.state.failAfterPages = backend.state.pagesServed + 1;
  t.clock.advance(1_000);
  const failed = await syncTitles(t);
  assert.equal(failed.status, 503);
  assert.equal(pick(failed.body, "error.code"), "backend.unreachable");

  assert.deepEqual(ids(t), ["movie-1", "movie-2", "movie-3", "tv-1", "tv-2"], "nothing was swept");
  const after = state(t);
  assert.equal(after?.synced_at, before?.synced_at);
  assert.equal(after?.error_code, "backend.unreachable");
  const library = await send(t.app, "GET", "/api/library");
  assert.equal(library.status, 200);
  assert.equal(pick(library.body, "data.total"), 5, "the cache still serves");
  await t.dispose();
});

test("a dictionary that cannot be read keeps the stored one, and fails the sync when none is stored", async () => {
  const { backend, t } = await bootTitles(FIVE);
  backend.state.genresDown = true;
  const cold = await syncTitles(t);
  assert.equal(cold.status, 503);
  assert.deepEqual(ids(t), [], "no dictionary, no walk");
  assert.equal(backend.catalogCalls().length, 0);

  backend.state.genresDown = false;
  t.clock.advance(1_000);
  assert.equal((await syncTitles(t)).status, 200);
  backend.state.genresDown = true;
  backend.publish([...FIVE, { id: "movie-9", title: "Zulu", year: 1964, genres: ["28"] }]);
  t.clock.advance(1_000);
  assert.equal((await syncTitles(t)).status, 200, "the stored dictionary decodes the new page");
  assert.deepEqual(peek(t, "SELECT genre FROM cached_title_genres WHERE title_id = 'movie-9'"), [{ genre: "Action" }]);
  await t.dispose();
});

test("a cursor that does not advance is stopped as a bad response, with nothing swept or stamped", async () => {
  const { backend, t } = await bootTitles(FIVE, { pageSize: 2 });
  backend.state.stuckCursor = true;
  const stuck = await syncTitles(t);
  assert.equal(stuck.status, 502);
  assert.equal(pick(stuck.body, "error.code"), "backend.bad_response");
  assert.equal(backend.catalogCalls().length, 2, "stopped at the first repeat, not walked forever");
  assert.equal(state(t)?.synced_at, null);
  assert.equal(state(t)?.error_code, "backend.bad_response");
  await t.dispose();
});

test("ten concurrent cold reads cause exactly one walk, and the sync sends no credentials", async () => {
  const { backend, t } = await bootTitles(FIVE, { pageSize: 2 });
  const release = backend.hold();
  const reads = Array.from({ length: 10 }, () => send(t.app, "GET", "/api/library"));
  while (backend.calls.length === 0) await new Promise((resolve) => setImmediate(resolve));
  release();
  for (const read of await Promise.all(reads)) assert.equal(pick(read.body, "data.total"), 5);

  assert.equal(backend.genreCalls().length, 2);
  assert.equal(backend.catalogCalls().length, 3, "one walk of three pages");
  for (const call of backend.calls) {
    assert.ok(call.url.startsWith(FAKE_ADMIN_URL));
    assert.equal(call.headers.get("authorization"), null);
    assert.equal(call.headers.get("cookie"), null);
    assert.equal(call.credentials, "omit");
  }
  await send(t.app, "GET", "/api/library");
  assert.equal(backend.catalogCalls().length, 3, "inside the window a read goes back to nobody");
  await t.dispose();
});

test("a warm cache a window old answers at once and refreshes once in the background", async () => {
  const { backend, t } = await bootTitles(FIVE);
  await syncTitles(t);
  const walked = backend.catalogCalls().length;
  backend.publish([...FIVE, { id: "movie-9", title: "Zulu" }]);
  t.clock.advance(CACHE_WINDOW_MS);
  const release = backend.hold();

  const reads = await Promise.all(Array.from({ length: 5 }, () => send(t.app, "GET", "/api/library")));
  for (const read of reads) assert.equal(pick(read.body, "data.total"), 5, "the stale cache answered now");
  release();
  await syncTitles(t);
  assert.equal(backend.catalogCalls().length, walked + 1, "one walk for five reads and a joined refresh");
  assert.deepEqual(idsOf((await send(t.app, "GET", "/api/library?sort=az&q=zulu")).body), ["movie-9"]);
  await t.dispose();
});
