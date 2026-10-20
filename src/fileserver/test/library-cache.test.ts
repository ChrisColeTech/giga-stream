// The Library over the cached titles (docs/46 section A): the five sorts, the filters, exact paging and totals, locals
// first, facets. Everything is answered from the fileserver's database after one sync.
import assert from "node:assert/strict";
import test from "node:test";

import { imageIdOf } from "../src/services/image-cache-service.js";
import { pick, send } from "./app-fixture.js";
import { manyMovies, type FakeTitle } from "./fake-titles.js";
import { allPages, bootTitles, idsOf, localFile, syncTitles } from "./library-fixture.js";

const POSTER = "https://image.tmdb.org/t/p/w500/alpha.jpg";

const CATALOG: FakeTitle[] = [
  { id: "movie-001", title: "alpha", year: 2000, popularity: 10, rating: 7.5, posterUrl: POSTER, genres: ["28"] },
  { id: "movie-002", title: "Bravo", year: 2000, popularity: 30, genres: ["28", "35"] },
  { id: "movie-003", title: "charlie", year: 2010, popularity: 20, genres: ["35"] },
  { id: "movie-004", title: "Delta", year: 1990, popularity: 5, genres: ["878"] },
  { id: "movie-005", title: "echo" },
  { id: "tv-001", title: "Foxtrot", year: 2010, popularity: 40, genres: ["18"] },
  { id: "tv-002", title: "golf", year: 2010, popularity: 40, genres: ["18"] },
  { id: "tv-003", title: "Hotel", year: 2022, genres: ["35"] },
];

async function synced(titles: FakeTitle[] = CATALOG) {
  const booted = await bootTitles(titles);
  await syncTitles(booted.t);
  return booted;
}

test("the five sorts end with the title (no case) and the id; rows with no year or popularity come last", async () => {
  const { t } = await synced();
  const sorted = async (sort: string): Promise<string[]> =>
    idsOf((await send(t.app, "GET", `/api/library?sort=${sort}`)).body);
  assert.deepEqual(await sorted("newest"), ["tv-003", "tv-001", "tv-002", "movie-003", "movie-002", "movie-001", "movie-004", "movie-005"]);
  assert.deepEqual(await sorted("oldest"), ["movie-004", "movie-002", "movie-001", "tv-001", "tv-002", "movie-003", "tv-003", "movie-005"]);
  assert.deepEqual(await sorted("year"), ["tv-003", "movie-003", "tv-001", "tv-002", "movie-001", "movie-002", "movie-004", "movie-005"]);
  assert.deepEqual(await sorted("az"), ["movie-001", "movie-002", "movie-003", "movie-004", "movie-005", "tv-001", "tv-002", "tv-003"]);
  assert.deepEqual(await sorted("trending"), ["tv-001", "tv-002", "movie-002", "movie-003", "movie-001", "movie-004", "movie-005", "tv-003"]);
  await t.dispose();
});

test("a card carries the cached facts: decoded genres, rating, year and the image-cache poster", async () => {
  const { t } = await synced();
  const page = await send(t.app, "GET", "/api/library?sort=az");
  const first = pick(page.body, "data.items.0") as Record<string, unknown>;
  assert.deepEqual(first.ref, { kind: "title", id: "movie-001" });
  assert.equal(first.kind, "movie");
  assert.deepEqual(first.genres, ["Action"]);
  assert.equal(first.rating, 7.5);
  assert.equal(first.year, 2000);
  assert.equal(first.posterUrl, `/api/images/${imageIdOf(POSTER)}`);
  assert.deepEqual(pick(page.body, "data.items.1.genres"), ["Action", "Comedy"]);
  await t.dispose();
});

test("Genre matches any of the chosen, Year is exact, type narrows the kind, and they combine", async () => {
  const { t } = await synced();
  const ids = async (query: string): Promise<string[]> => idsOf((await send(t.app, "GET", `/api/library?${query}`)).body);
  assert.deepEqual(await ids("genre=Comedy&sort=az"), ["movie-002", "movie-003", "tv-003"]);
  assert.deepEqual(await ids("genre=Action&genre=Science%20Fiction&sort=az"), ["movie-001", "movie-002", "movie-004"]);
  assert.deepEqual(await ids("year=2010"), ["tv-001", "tv-002", "movie-003"]);
  assert.deepEqual(await ids("type=tv&sort=az"), ["tv-001", "tv-002", "tv-003"]);
  assert.deepEqual(await ids("type=movie&genre=Comedy&year=2000"), ["movie-002"]);
  assert.deepEqual(await ids("genre=Nothing"), []);
  const none = await send(t.app, "GET", "/api/library?genre=Nothing");
  assert.equal(pick(none.body, "data.total"), 0);
  assert.equal(pick(none.body, "data.nextCursor"), undefined);
  await t.dispose();
});

test("Unwatched leaves out every title with a watch entry, and the total follows", async () => {
  const { t } = await synced();
  await send(t.app, "PUT", "/api/watch", { item: { kind: "title", id: "movie-001" }, positionMs: 100, durationMs: 90_000, playbackId: "p1", seq: 1 });
  await send(t.app, "PUT", "/api/watch", { item: { kind: "title", id: "tv-001" }, season: 1, episode: 1, positionMs: 89_900, durationMs: 90_000, playbackId: "p2", seq: 1 });
  const page = await send(t.app, "GET", "/api/library?watched=unwatched&sort=az");
  assert.deepEqual(idsOf(page.body), ["movie-002", "movie-003", "movie-004", "movie-005", "tv-002", "tv-003"]);
  assert.equal(pick(page.body, "data.total"), 6);
  const all = await send(t.app, "GET", "/api/library?sort=az");
  assert.equal(pick(all.body, "data.items.0.progress.state"), "watching", "the card carries the user's progress");
  await t.dispose();
});

test("local files come first, then the cached titles; the cursor and the total are exact across 3 pages", async () => {
  const { t } = await synced(manyMovies(45));
  const locals = [1, 2, 3].map((n) => localFile(t, `File ${n}.mkv`, { addedAt: n }));
  const pages = await allPages(t, "type=movie&type=local&sort=az");
  assert.deepEqual(pages.map((page) => (pick(page.body, "data.items") as unknown[]).length), [20, 20, 8]);
  for (const page of pages) assert.equal(pick(page.body, "data.total"), 48, "locals plus every cached match, on every page");
  const all = pages.flatMap((page) => idsOf(page.body));
  assert.equal(new Set(all).size, 48, "no row twice, none skipped");
  assert.deepEqual(new Set(all.slice(0, 3)), new Set(locals), "the files lead the first page");
  assert.deepEqual(all.slice(3, 6), ["movie-001", "movie-002", "movie-003"]);
  assert.equal(pick(pages[2]?.body, "data.nextCursor"), undefined);
  const titlesOnly = await allPages(t, "type=movie&sort=az");
  assert.deepEqual(titlesOnly.map((page) => idsOf(page.body).length), [20, 20, 5]);
  const filesOnly = await send(t.app, "GET", "/api/library?type=local");
  assert.equal(pick(filesOnly.body, "data.total"), 3);
  await t.dispose();
});

test("facets: the genres the cache holds for the asked kinds, this year back thirty, a chosen value kept", async () => {
  const { t } = await synced();
  const all = await send(t.app, "GET", "/api/library");
  assert.deepEqual(pick(all.body, "data.facets.genres"), ["Action", "Comedy", "Drama", "Science Fiction"]);
  assert.equal(pick(all.body, "data.facets.years.length"), 30);
  assert.equal(pick(all.body, "data.facets.years.0"), 2026);
  const tv = await send(t.app, "GET", "/api/library?type=tv");
  assert.deepEqual(pick(tv.body, "data.facets.genres"), ["Comedy", "Drama"]);
  const local = await send(t.app, "GET", "/api/library?type=local&genre=Mystery");
  assert.deepEqual(pick(local.body, "data.facets.genres"), ["Mystery"]);
  await t.dispose();
});

test("the cursor of an older build still decodes, and a bad one is 422 library.invalid", async () => {
  const { t } = await synced();
  const old = Buffer.from(JSON.stringify({ localOffset: 0, titlePage: 3 }), "utf-8").toString("base64url");
  assert.equal((await send(t.app, "GET", `/api/library?cursor=${old}`)).status, 200);
  const bad = await send(t.app, "GET", "/api/library?cursor=not-a-cursor");
  assert.equal(bad.status, 422);
  assert.equal(pick(bad.body, "error.code"), "library.invalid");
  await t.dispose();
});
