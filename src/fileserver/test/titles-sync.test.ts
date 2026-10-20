import assert from "node:assert/strict";
import test from "node:test";

import { CACHE_WINDOW_MS, CATALOG_PAGE_SIZE } from "../src/constants/backend-cache.js";
import { pick, send } from "./app-fixture.js";
import { bootTitles, idsOf, peek, syncTitles } from "./library-fixture.js";
import { manyMovies, type FakeTitle } from "./fake-titles.js";

const FIVE: FakeTitle[] = [
  { id: "movie-1", title: "Alien", year: 1979, popularity: 50, genres: ["878", "28"] },
  { id: "movie-2", title: "Blade", year: 1998, popularity: 40, genres: ["28", "999999"] },
  { id: "movie-3", title: "Casablanca", year: 1942, genres: ["Romance"] },
  { id: "tv-1", title: "Dark", year: 2017, popularity: 30, genres: ["18"] },
  { id: "tv-2", title: "Eureka", year: 2006, genres: ["35"] },
];

const state = (t: Parameters<typeof peek>[0]) =>
  peek(t, "SELECT * FROM cache_state WHERE dataset = 'titles'")[0];
const cachedIds = (t: Parameters<typeof peek>[0]) =>
  peek(t, "SELECT id FROM cached_titles ORDER BY id").map((row) => row.id);

test("a cold direct SQL walk uses 500-row keyset pages and decodes the genre dictionary", async () => {
  const catalog = manyMovies(CATALOG_PAGE_SIZE * 2 + 1);
  const { backend, t } = await bootTitles(catalog);
  const refreshed = await syncTitles(t);
  assert.equal(refreshed.status, 200);
  assert.equal(backend.catalogCalls().length, 3);
  assert.equal(backend.genreCalls().length, 2);
  assert.equal(cachedIds(t).length, catalog.length);
  assert.deepEqual(
    peek(t, "SELECT genre FROM cached_title_genres WHERE title_id = 'movie-001'"),
    [{ genre: "Action" }],
  );
  assert.equal(state(t)?.run, 1);
  await t.dispose();
});

test("a missing authoritative title is swept while an opened detail survives list-column refresh", async () => {
  const { backend, t } = await bootTitles(FIVE);
  await syncTitles(t);
  backend.state.details["movie-1"] = {
    id: "movie-1", tmdbId: 1, kind: "movie", title: "Alien", genres: ["Action"], plot: "In space.",
  };
  await send(t.app, "GET", "/api/titles/movie-1");
  backend.publish(FIVE.filter((title) => title.id !== "movie-3").map((title) =>
    title.id === "movie-1" ? { ...title, title: "Alien (Director's Cut)", year: 1980 } : title));
  t.clock.advance(1_000);
  assert.equal((await syncTitles(t)).status, 200);
  assert.deepEqual(cachedIds(t), ["movie-1", "movie-2", "tv-1", "tv-2"]);
  assert.deepEqual(
    peek(t, "SELECT title, year, plot FROM cached_titles WHERE id = 'movie-1'")[0],
    { title: "Alien (Director's Cut)", year: 1980, plot: "In space." },
  );
  await t.dispose();
});

test("a Turso failure mid-walk retains rows, skips the sweep, and stamps only the error", async () => {
  const catalog = manyMovies(CATALOG_PAGE_SIZE + 2);
  const { backend, t } = await bootTitles(catalog);
  await syncTitles(t);
  const before = state(t);
  backend.publish(catalog.filter((title) => title.id !== "movie-001"));
  backend.state.failAfterPages = backend.state.pagesServed + 1;
  t.clock.advance(1_000);
  const failed = await syncTitles(t);
  assert.deepEqual([failed.status, pick(failed.body, "error.code")], [503, "backend.unreachable"]);
  assert.equal(cachedIds(t).length, catalog.length);
  assert.equal(state(t)?.synced_at, before?.synced_at);
  assert.equal(state(t)?.error_code, "backend.unreachable");
  await t.dispose();
});

test("a failed genre read keeps a stored dictionary and refuses a cold cache without one", async () => {
  const { backend, t } = await bootTitles(FIVE);
  backend.state.genresDown = true;
  const cold = await syncTitles(t);
  assert.equal(cold.status, 503);
  assert.deepEqual(cachedIds(t), []);
  backend.state.genresDown = false;
  assert.equal((await syncTitles(t)).status, 200);
  backend.state.genresDown = true;
  backend.publish([...FIVE, { id: "movie-9", title: "Zulu", genres: ["28"] }]);
  assert.equal((await syncTitles(t)).status, 200);
  assert.deepEqual(
    peek(t, "SELECT genre FROM cached_title_genres WHERE title_id = 'movie-9'"),
    [{ genre: "Action" }],
  );
  await t.dispose();
});

test("keyset paging advances without repeats across direct SQL pages", async () => {
  const catalog = manyMovies(CATALOG_PAGE_SIZE + 1);
  const { backend, t } = await bootTitles(catalog);
  assert.equal((await syncTitles(t)).status, 200);
  assert.equal(backend.catalogCalls().length, 2);
  assert.equal(new Set(cachedIds(t)).size, catalog.length);
  await t.dispose();
});

test("ten concurrent cold reads share one direct SQL walk", async () => {
  const { backend, t } = await bootTitles(FIVE);
  const release = backend.hold();
  const reads = Array.from({ length: 10 }, () => send(t.app, "GET", "/api/library"));
  while (backend.calls.length === 0) await new Promise((resolve) => setImmediate(resolve));
  release();
  for (const read of await Promise.all(reads)) assert.equal(pick(read.body, "data.total"), 5);
  assert.equal(backend.catalogCalls().length, 1);
  await t.dispose();
});

test("a warm stale cache answers immediately and refreshes once", async () => {
  const { backend, t } = await bootTitles(FIVE);
  await syncTitles(t);
  const before = backend.catalogCalls().length;
  backend.publish([...FIVE, { id: "movie-9", title: "Zulu" }]);
  t.clock.advance(CACHE_WINDOW_MS);
  const release = backend.hold();
  const reads = await Promise.all(Array.from({ length: 5 }, () => send(t.app, "GET", "/api/library")));
  for (const read of reads) assert.equal(pick(read.body, "data.total"), 5);
  release();
  await syncTitles(t);
  assert.equal(backend.catalogCalls().length, before + 1);
  assert.deepEqual(idsOf((await send(t.app, "GET", "/api/library?q=zulu")).body), ["movie-9"]);
  await t.dispose();
});
