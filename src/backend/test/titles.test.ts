import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";

import { makeApp, pick, send, signIn } from "./test-app.js";
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

test("a fresh browse list and its title rows are served from the store after restart", async () => {
  const tmdb = await stubTmdb();
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "title-list-restart-"));
  const first = await makeApp({ dataDir, config: tmdbOn(tmdb) });
  const initial = await send(first.app, "GET", "/api/titles?kind=movie&sort=newest&page=1");
  assert.equal(pick(initial.body, "data.items.0.title"), "The Matrix");
  const calls = tmdb.calls.filter((call) => call.startsWith("/discover/movie")).length;
  await first.dispose();

  const second = await makeApp({ dataDir, config: tmdbOn(tmdb) });
  const cached = await send(second.app, "GET", "/api/titles?kind=movie&sort=newest&page=1");
  assert.equal(pick(cached.body, "data.items.0.title"), "The Matrix");
  assert.equal(tmdb.calls.filter((call) => call.startsWith("/discover/movie")).length, calls);
  await second.dispose();
  rmSync(dataDir, { recursive: true, force: true });
});

test("a fresh cached list with a missing title row refetches TMDB", async () => {
  const tmdb = await stubTmdb();
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "title-list-missing-"));
  const first = await makeApp({ dataDir, config: tmdbOn(tmdb) });
  await send(first.app, "GET", "/api/titles?kind=movie&sort=newest&page=1");
  await first.dispose();
  const db = new DatabaseSync(path.join(dataDir, "admin.db"));
  db.prepare("DELETE FROM titles WHERE kind = 'movie' AND tmdb_id = 603").run();
  db.close();
  const calls = tmdb.calls.length;

  const second = await makeApp({ dataDir, config: tmdbOn(tmdb) });
  const refilled = await send(second.app, "GET", "/api/titles?kind=movie&sort=newest&page=1");
  assert.equal(pick(refilled.body, "data.items.0.title"), "The Matrix");
  assert.ok(tmdb.calls.length > calls);
  await second.dispose();
  rmSync(dataDir, { recursive: true, force: true });
});

test("a fresh cached list with a blank stored title refetches TMDB", async () => {
  const tmdb = await stubTmdb();
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "title-list-blank-"));
  const first = await makeApp({ dataDir, config: tmdbOn(tmdb) });
  await send(first.app, "GET", "/api/titles?kind=movie&sort=newest&page=1");
  await first.dispose();
  const db = new DatabaseSync(path.join(dataDir, "admin.db"));
  db.prepare("UPDATE titles SET payload = ? WHERE kind = 'movie' AND tmdb_id = 603").run(
    JSON.stringify({ id: "movie-603", tmdbId: 603, kind: "movie", title: "   " }),
  );
  db.close();
  const calls = tmdb.calls.length;

  const second = await makeApp({ dataDir, config: tmdbOn(tmdb) });
  const refilled = await send(second.app, "GET", "/api/titles?kind=movie&sort=newest&page=1");
  assert.equal(pick(refilled.body, "data.items.0.title"), "The Matrix");
  assert.ok(tmdb.calls.length > calls);
  await second.dispose();
  rmSync(dataDir, { recursive: true, force: true });
});

test("malformed TMDB siblings are skipped while valid movie and TV names remain", async () => {
  const tmdb = await stubTmdb({
    movieRows: [
      { id: 603, title: "The Matrix", release_date: "1999-03-31" },
      { id: 700, title: "   " },
      { id: 702, name: "Not a movie title" },
      { id: 701, title: "Valid Sibling", release_date: "2026-01-02" },
    ],
    tvRows: [
      { id: 1399, name: "Game of Thrones", first_air_date: "2011-04-17" },
      { id: 1400, title: "Not a TV name" },
    ],
    recommendationRows: [{ id: 701, title: "Valid Sibling" }, { id: 702, title: "\t" }],
  });
  const t = await makeApp({ config: tmdbOn(tmdb) });
  const movie = await send(t.app, "GET", "/api/titles?kind=movie&sort=newest&page=1");
  const tv = await send(t.app, "GET", "/api/titles?kind=tv&sort=newest&page=1");
  const search = await send(t.app, "GET", "/api/titles/search?kind=movie&q=matrix&page=1");
  const detail = await send(t.app, "GET", "/api/titles/movie-603");
  const related = await send(t.app, "GET", "/api/titles/movie-603/recommendations");
  assert.deepEqual(pick(movie.body, "data.items") as unknown[], [
    { id: "movie-603", tmdbId: 603, kind: "movie", shape: "list", title: "The Matrix", year: 1999, genres: [], state: "synced" },
    { id: "movie-701", tmdbId: 701, kind: "movie", shape: "list", title: "Valid Sibling", year: 2026, genres: [], state: "synced" },
  ]);
  assert.equal(pick(movie.body, "data.totalResults"), 4, "TMDB's total is preserved when members are skipped");
  assert.equal(pick(tv.body, "data.items.0.title"), "Game of Thrones");
  assert.equal(pick(search.body, "data.items.1.title"), "Valid Sibling");
  assert.equal(pick(detail.body, "data.title"), "The Matrix");
  assert.equal(pick(related.body, "data.items.0.title"), "Valid Sibling");
  for (const answer of [movie, tv, search, related]) {
    const rows = pick(answer.body, "data.items") as Array<Record<string, unknown>>;
    assert.ok(rows.every((row) => typeof row.title === "string" && row.title.trim() !== ""));
  }
  await t.dispose();
});

test("a series detail maps TMDB's seasons, leaving out the specials and empty seasons", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: tmdbOn(tmdb) });
  const detail = await send(t.app, "GET", "/api/titles/tv-1399");
  assert.deepEqual(pick(detail.body, "data.seasons"), [{ season: 1, episodeCount: 10 }]);
  await t.dispose();
});

test("a series detail stored before the seasons mapping is healed by one forced refetch", async () => {
  const tmdb = await stubTmdb();
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "title-seasons-"));
  const first = await makeApp({ dataDir, config: tmdbOn(tmdb) });
  await send(first.app, "GET", "/api/titles/tv-1399");
  await first.dispose();
  const db = new DatabaseSync(path.join(dataDir, "admin.db"));
  db.prepare("UPDATE titles SET payload = ? WHERE kind = 'tv' AND tmdb_id = 1399").run(
    JSON.stringify({ id: "tv-1399", tmdbId: 1399, kind: "tv", shape: "detail", title: "Game of Thrones", genres: [] }),
  );
  db.close();

  const second = await makeApp({ dataDir, config: tmdbOn(tmdb) });
  const healed = await send(second.app, "GET", "/api/titles/tv-1399");
  assert.deepEqual(pick(healed.body, "data.seasons"), [{ season: 1, episodeCount: 10 }]);
  await second.dispose();
  rmSync(dataDir, { recursive: true, force: true });
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

/** A manual series of `seasons` seasons, each of 500 episodes with a long title: about 33 KB a season. */
function longSeasons(seasons: number) {
  const episodes = (season: number) =>
    Array.from({ length: 500 }, (_, e) => ({
      episode: e + 1,
      title: `Episode ${e + 1} of season ${season} with a long title`,
    }));
  return Array.from({ length: seasons }, (_, s) => ({ season: s + 1, episodes: episodes(s + 1) }));
}

test("a manual series over the default 64 KiB body limit is accepted; one over 256 KiB is refused", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  const series = (seasons: number) => ({ kind: "tv", title: "Long Series", seasons: longSeasons(seasons) });
  const fits = await send(t.app, "POST", "/api/titles", series(3), token);
  assert.equal(fits.status, 201, "about 100 KB is accepted");
  const id = String(pick(fits.body, "data.id"));
  const edited = await send(t.app, "PATCH", `/api/titles/${id}`, { seasons: longSeasons(3) }, token);
  assert.equal(edited.status, 200, "a PATCH takes the same limit");
  const tooLarge = await send(t.app, "POST", "/api/titles", series(10), token);
  assert.deepEqual([tooLarge.status, pick(tooLarge.body, "error.code")], [400, "request.invalid"]);
});
