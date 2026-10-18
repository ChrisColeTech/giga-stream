// The Library's reads that must not touch the backend (docs/46 sections A and C): offline serving, search, the list
// views and Continue, trending from the stored popularity.
import assert from "node:assert/strict";
import test from "node:test";

import { CACHE_WINDOW_MS } from "../src/constants/backend-cache.js";
import { pick, send } from "./app-fixture.js";
import type { FakeTitle } from "./fake-titles.js";
import { bootTitles, idsOf, localFile, syncTitles } from "./library-fixture.js";

const CATALOG: FakeTitle[] = [
  { id: "movie-001", title: "alpha", year: 2000, popularity: 10, genres: ["28"] },
  { id: "movie-002", title: "Bravo", year: 2000, popularity: 30, genres: ["28", "35"] },
  { id: "movie-003", title: "charlie", year: 2010, popularity: 20, genres: ["35"] },
  { id: "movie-005", title: "echo" },
  { id: "tv-001", title: "Foxtrot", year: 2010, popularity: 40, genres: ["18"] },
  { id: "tv-002", title: "golf", year: 2010, popularity: 40, genres: ["18"] },
  { id: "tv-003", title: "Hotel 100%", year: 2022, genres: ["35"] },
];

async function synced(titles: FakeTitle[] = CATALOG) {
  const booted = await bootTitles(titles);
  await syncTitles(booted.t);
  return booted;
}

test("with the backend down, a stale cache keeps serving every read and titlesAvailable stays true", async () => {
  const { backend, t } = await synced();
  backend.state.down = true;
  t.clock.advance(CACHE_WINDOW_MS * 2);
  const page = await send(t.app, "GET", "/api/library?sort=az");
  assert.equal(page.status, 200);
  assert.equal(pick(page.body, "data.titlesAvailable"), true);
  assert.equal(pick(page.body, "data.trending"), true);
  assert.equal(pick(page.body, "data.total"), 7);
  assert.equal((await send(t.app, "GET", "/api/library?sort=trending")).status, 200);
  const refused = await syncTitles(t);
  assert.equal(refused.status, 503);
  assert.equal(pick(refused.body, "error.code"), "backend.unreachable");
  assert.equal(pick((await send(t.app, "GET", "/api/library")).body, "data.total"), 7, "the cache is intact after the failed refresh");
  await t.dispose();
});

test("an empty cache with the backend down is titlesAvailable false and trending false; trending is refused", async () => {
  const { backend, t } = await bootTitles(CATALOG);
  backend.state.down = true;
  localFile(t, "Home.mkv");
  const page = await send(t.app, "GET", "/api/library");
  assert.equal(page.status, 200);
  assert.equal(pick(page.body, "data.titlesAvailable"), false);
  assert.equal(pick(page.body, "data.trending"), false);
  assert.equal(pick(page.body, "data.items.length"), 1, "the user's files still answer");
  const refused = await send(t.app, "GET", "/api/library?sort=trending");
  assert.equal(refused.status, 422);
  assert.equal(pick(refused.body, "error.code"), "library.invalid");
  await t.dispose();
});

test("trending is offered only when a stored popularity exists, and orders by it", async () => {
  const { t } = await synced([{ id: "movie-001", title: "Plain" }, { id: "movie-002", title: "Other" }]);
  const flat = await send(t.app, "GET", "/api/library");
  assert.equal(pick(flat.body, "data.trending"), false);
  assert.equal((await send(t.app, "GET", "/api/library?sort=trending")).status, 422);
  await t.dispose();

  const rich = await synced();
  const page = await send(rich.t.app, "GET", "/api/library?sort=trending&type=movie");
  assert.equal(pick(page.body, "data.trending"), true);
  assert.deepEqual(idsOf(page.body), ["movie-002", "movie-003", "movie-001", "movie-005"]);
  await rich.t.dispose();
});

test("search is a LIKE over the cached titles ordered by popularity and makes ZERO backend requests", async () => {
  const { backend, t } = await synced();
  backend.state.down = true;
  const before = backend.calls.length;
  const search = async (q: string, extra = ""): Promise<string[]> =>
    idsOf((await send(t.app, "GET", `/api/library?q=${encodeURIComponent(q)}${extra}`)).body);

  assert.deepEqual(await search("ALPHA"), ["movie-001"], "case-insensitive");
  assert.deepEqual(await search("o"), ["tv-001", "tv-002", "movie-002", "movie-005", "tv-003"], "popularity, then title");
  assert.deepEqual(await search("o", "&sort=az"), ["tv-001", "tv-002", "movie-002", "movie-005", "tv-003"], "a search ignores the sort");
  assert.deepEqual(await search("o", "&type=tv&year=2010"), ["tv-001", "tv-002"], "it narrows like any other read");
  assert.deepEqual(await search("100%"), ["tv-003"], "% is literal");
  assert.deepEqual(await search("%"), ["tv-003"]);
  assert.deepEqual(await search("zzz"), []);
  const none = await send(t.app, "GET", "/api/library?q=zzz");
  assert.equal(pick(none.body, "data.total"), 0);
  assert.equal(backend.calls.length, before, "no request: the sweep of searches never reached the backend");
  await t.dispose();
});

test("history, favorites, collection and Continue rows come from the cache with zero backend calls", async () => {
  const { backend, t } = await synced();
  await send(t.app, "PUT", "/api/favorites/title/movie-002");
  await send(t.app, "PUT", "/api/watch", { item: { kind: "title", id: "movie-001" }, positionMs: 100, durationMs: 90_000, playbackId: "p1", seq: 1 });
  t.clock.advance(1_000);
  await send(t.app, "PUT", "/api/watch", { item: { kind: "title", id: "tv-001" }, season: 1, episode: 2, positionMs: 89_900, durationMs: 90_000, playbackId: "p2", seq: 1 });
  t.clock.advance(1_000);
  await send(t.app, "PUT", "/api/watch", { item: { kind: "title", id: "movie-404" }, positionMs: 100, durationMs: 90_000, playbackId: "p3", seq: 1 });
  const made = await send(t.app, "POST", "/api/collections", { name: "Lane", type: "local" });
  const collectionId = String(pick(made.body, "data.id"));
  await send(t.app, "PUT", `/api/collections/${collectionId}/items`, { kind: "title", id: "movie-003" });
  const before = backend.calls.length;

  const history = await send(t.app, "GET", "/api/library?view=history");
  const rows = pick(history.body, "data.items") as Array<Record<string, unknown>>;
  assert.deepEqual(rows.map((one) => one.title), ["movie-404", "Foxtrot", "alpha"], "a title the cache lacks is a skeleton");
  assert.deepEqual(rows[1]?.genres, ["Drama"]);
  assert.equal(rows[1]?.year, 2010);
  assert.equal(pick(history.body, "data.titlesAvailable"), true);

  const favorites = await send(t.app, "GET", "/api/library?view=favorites");
  assert.deepEqual(pick(favorites.body, "data.items.0.genres"), ["Action", "Comedy"]);
  assert.equal(pick(favorites.body, "data.items.0.title"), "Bravo");
  const collection = await send(t.app, "GET", `/api/library?view=collection&collectionId=${collectionId}`);
  assert.equal(pick(collection.body, "data.items.0.title"), "charlie");
  assert.equal(pick(collection.body, "data.items.0.collectionSource"), "manual");
  const comedy = await send(t.app, "GET", "/api/library?view=history&genre=Drama");
  assert.deepEqual(idsOf(comedy.body), ["tv-001"], "list views filter on the cached facts");
  const watching = await send(t.app, "GET", "/api/library/continue");
  assert.deepEqual((pick(watching.body, "data.items") as Array<{ title: string }>).map((one) => one.title), ["movie-404", "alpha"]);
  assert.equal(pick(watching.body, "data.items.1.year"), 2000);

  assert.equal(backend.calls.length, before, "not one request for all of it");
  await t.dispose();
});
