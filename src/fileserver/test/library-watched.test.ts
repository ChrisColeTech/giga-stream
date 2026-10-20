// The user's watch state over the cached titles: the history-backed `watched` answers and Unwatched, paged by the
// cursor with exact totals (docs/03 section 3.5, docs/46 section A).
import assert from "node:assert/strict";
import test from "node:test";

import { pick, send, type FileserverApp } from "./app-fixture.js";
import type { FakeTitle } from "./fake-titles.js";
import { allPages, bootTitles, idsOf, syncTitles } from "./library-fixture.js";

/** `movies` movies and `shows` series: a title whose number divides by `every` is from 2020, the rest 1990; even is Drama. */
function catalog(movies: number, shows: number, every = 10): FakeTitle[] {
  const make = (kind: "movie" | "tv", count: number): FakeTitle[] =>
    Array.from({ length: count }, (_, at) => {
      const n = at + 1;
      return { id: `${kind}-${n}`, kind, title: `${kind} ${n}`, year: n % every === 0 ? 2020 : 1990, genres: [n % 2 === 0 ? "Drama" : "Comedy"] };
    });
  return [...make("movie", movies), ...make("tv", shows)];
}

async function seeded(movies: number, shows: number, every = 10) {
  const booted = await bootTitles(catalog(movies, shows, every));
  await syncTitles(booted.t);
  return booted.t;
}

let playback = 0;
const watch = (t: FileserverApp, id: string, positionMs: number) =>
  send(t.app, "PUT", "/api/watch", { item: { kind: "title", id }, positionMs, durationMs: 90_000, playbackId: `p${playback++}`, seq: 1 });

async function pagesOf(t: FileserverApp, query: string): Promise<string[][]> {
  const pages = await allPages(t, query);
  for (const page of pages) assert.equal(page.status, 200);
  return pages.map((page) => idsOf(page.body));
}

test("watched=watching and watched=watched answer the history items, full pages, no cursor at the end", async () => {
  const t = await seeded(60, 40);
  for (let n = 1; n <= 25; n++) await watch(t, `movie-${n}`, 100);
  for (let n = 1; n <= 5; n++) await watch(t, `tv-${n}`, 100);
  for (let n = 31; n <= 33; n++) await watch(t, `movie-${n}`, 89_500);

  const first = await send(t.app, "GET", "/api/library?watched=watching");
  assert.equal(pick(first.body, "data.items.length"), 20);
  assert.equal(pick(first.body, "data.total"), 30);
  const pages = await pagesOf(t, "watched=watching");
  assert.deepEqual(pages.map((one) => one.length), [20, 10]);
  assert.equal(new Set(pages.flat()).size, 30, "no row repeats across pages");
  assert.ok(pages.flat().every((id) => !["movie-31", "movie-32", "movie-33"].includes(id)));
  assert.deepEqual((await pagesOf(t, "watched=watched")).map((one) => one.sort()), [["movie-31", "movie-32", "movie-33"]]);
  await t.dispose();
});

test("the history set honours a type scope, genre and year together, from the cached facts", async () => {
  const t = await seeded(60, 40);
  for (let n = 1; n <= 25; n++) await watch(t, `movie-${n}`, 100);
  for (let n = 1; n <= 5; n++) await watch(t, `tv-${n}`, 100);
  assert.deepEqual((await pagesOf(t, "type=tv&watched=watching")).map((one) => one.length), [5]);
  assert.deepEqual((await pagesOf(t, "type=movie&watched=watching")).map((one) => one.length), [20, 5]);
  assert.deepEqual((await pagesOf(t, "type=movie&watched=watching&year=2020&genre=Drama")).flat().sort(), ["movie-10", "movie-20"]);
  const none = await send(t.app, "GET", "/api/library?type=movie&watched=watched");
  assert.deepEqual(idsOf(none.body), []);
  assert.equal(pick(none.body, "data.nextCursor"), undefined);
  await t.dispose();
});

test("a cursor resumes in the titles at its offset, and one of an older build still decodes", async () => {
  const t = await seeded(60, 40);
  for (let n = 1; n <= 25; n++) await watch(t, `movie-${n}`, 100);
  const old = Buffer.from(JSON.stringify({ localOffset: 20, titlePage: 0 }), "utf-8").toString("base64url");
  const second = await send(t.app, "GET", `/api/library?watched=watching&cursor=${old}`);
  assert.equal(second.status, 200);
  assert.equal(pick(second.body, "data.items.length"), 5);

  const azMovies = Array.from({ length: 60 }, (_, at) => `movie ${at + 1}`).sort();
  const cursor = Buffer.from(JSON.stringify({ localOffset: 0, titleOffset: 20 }), "utf-8").toString("base64url");
  const later = await send(t.app, "GET", `/api/library?type=movie&sort=az&cursor=${cursor}`);
  assert.equal(pick(later.body, "data.items.0.title"), azMovies[20]);
  assert.equal(pick(later.body, "data.items.length"), 20);
  await t.dispose();
});

test("watched=unwatched pages are exact: every title without progress once, the total follows", async () => {
  const t = await seeded(60, 40);
  await watch(t, "movie-10", 100);
  const plain = await send(t.app, "GET", "/api/library?watched=unwatched");
  assert.equal(pick(plain.body, "data.items.length"), 20);
  assert.equal(pick(plain.body, "data.total"), 99);
  assert.ok(!idsOf(plain.body).includes("movie-10"), "a title with progress is not unwatched");
  const everything = (await pagesOf(t, "watched=unwatched")).flat();
  assert.equal(new Set(everything).size, 99);
  assert.deepEqual((await pagesOf(t, "watched=unwatched&year=2020")).map((one) => one.length), [9], "six movies and four series, one watched");
  await t.dispose();
});

test("a sparse filter over many titles is answered whole in one request, with no bound to run into", async () => {
  const t = await seeded(300, 0, 100);
  const first = await send(t.app, "GET", "/api/library?type=movie&watched=unwatched&year=2020");
  assert.deepEqual(idsOf(first.body), ["movie-100", "movie-200", "movie-300"]);
  assert.equal(pick(first.body, "data.nextCursor"), undefined);
  await t.dispose();
});
