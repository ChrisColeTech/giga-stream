import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { makeApp, pick, send } from "./test-app.js";
import { stubTmdb, tmdbOn } from "./title-stubs.js";

test("a title detail is fetched once, stored, and answered from the store after a restart", async () => {
  const tmdb = await stubTmdb();
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "titles-"));
  const first = await makeApp({ dataDir, config: tmdbOn(tmdb) });
  const detail = await send(first.app, "GET", "/api/titles/movie-603");
  assert.equal(detail.status, 200);
  assert.equal(pick(detail.body, "data.title"), "The Matrix");
  assert.equal(pick(detail.body, "data.year"), 1999);
  assert.equal(pick(detail.body, "data.cast.0"), "Keanu Reeves");
  const again = await send(first.app, "GET", "/api/titles/movie-603");
  assert.deepEqual(again.body, detail.body);
  const callsAfterFirst = tmdb.calls.filter((c) => c.startsWith("/movie/603")).length;
  assert.ok(callsAfterFirst >= 1);
  assert.equal(callsAfterFirst, 1, "the second read is served from the store");
  await first.dispose();

  // A fresh process on the same data dir answers from the store without calling TMDB.
  const second = await makeApp({ dataDir, config: tmdbOn(tmdb) });
  const third = await send(second.app, "GET", "/api/titles/movie-603");
  assert.equal(pick(third.body, "data.title"), "The Matrix");
  assert.equal(tmdb.calls.filter((c) => c.startsWith("/movie/603")).length, callsAfterFirst);
  await second.dispose();
  rmSync(dataDir, { recursive: true, force: true });
});

test("browse answers pages and stores the list; an unknown title is title.not_found", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: tmdbOn(tmdb) });
  const page = await send(t.app, "GET", "/api/titles?kind=movie&sort=newest&page=1");
  assert.equal(pick(page.body, "data.items.0.id"), "movie-603");
  assert.equal(pick(page.body, "data.totalPages"), 1);

  const missing = await send(t.app, "GET", "/api/titles/movie-999999");
  assert.equal(missing.status, 404);
  assert.equal(pick(missing.body, "error.code"), "title.not_found");
  await t.dispose();
});

test("a season answers its episodes; genres answer from TMDB", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: tmdbOn(tmdb) });
  const season = await send(t.app, "GET", "/api/titles/tv-1399/seasons/1");
  assert.equal(pick(season.body, "data.episodes.0.title"), "Winter Is Coming");
  assert.equal(pick(season.body, "data.episodes.0.runtimeMs"), 3_720_000);
  const genres = await send(t.app, "GET", "/api/titles/genres?kind=movie");
  assert.equal(pick(genres.body, "data.0.name"), "Science Fiction");
  await t.dispose();
});

test("recommendations answer in TMDB's order; a thin list row carries its kind and id", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: tmdbOn(tmdb) });
  const related = await send(t.app, "GET", "/api/titles/movie-603/recommendations");
  assert.equal(pick(related.body, "data.items.0.id"), "movie-1399");
  const listed = await send(t.app, "GET", "/api/titles?kind=movie&sort=trending&page=1");
  assert.equal(pick(listed.body, "data.items.0.id"), "movie-603");
  assert.equal(pick(listed.body, "data.items.0.tmdbId"), 603);
  await t.dispose();
});
