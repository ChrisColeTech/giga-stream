// The public title reads are store-only (docs/47 section 3.2): the Library fill stores, the reads serve what is stored.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";

import { makeApp, pick, send, signIn } from "./test-app.js";
import { fillLibrary, forbiddenTmdb, stubTmdb, tmdbOn } from "./title-stubs.js";

/** Every row of the titles table, as one string: equal before and after means nothing was written. */
function snapshot(dataDir: string): string {
  const db = new DatabaseSync(path.join(dataDir, "admin.db"), { readOnly: true });
  try {
    return JSON.stringify(db.prepare("SELECT id, payload, fetched_at, popularity_score FROM titles ORDER BY id").all());
  } finally {
    db.close();
  }
}

test("a title is stored by the Library fill and answered from the store, also after a restart", async () => {
  const tmdb = await stubTmdb();
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "titles-"));
  const first = await makeApp({ dataDir, config: tmdbOn(tmdb) });
  assert.equal((await send(first.app, "GET", "/api/titles/movie-603")).status, 404, "nothing is fetched on a read");
  assert.equal(tmdb.calls.length, 0);
  await fillLibrary(first);
  const detail = await send(first.app, "GET", "/api/titles/movie-603");
  assert.equal(detail.status, 200);
  assert.deepEqual(
    ["shape", "title", "year", "cast.0", "imdbId"].map((f) => pick(detail.body, `data.${f}`)),
    ["detail", "The Matrix", 1999, "Keanu Reeves", "tt0133093"],
  );
  const calls = tmdb.calls.length;
  await first.dispose();

  const second = await makeApp({ dataDir, config: tmdbOn(tmdb) });
  assert.deepEqual((await send(second.app, "GET", "/api/titles/movie-603")).body, detail.body);
  assert.equal(tmdb.calls.length, calls, "a restart answers from the store");
  await second.dispose();
  rmSync(dataDir, { recursive: true, force: true });
});

test("no public title route calls TMDB or writes the store: a TMDB that fails on any call is never called", async () => {
  const stub = await stubTmdb();
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "titles-store-only-"));
  const filled = await makeApp({ dataDir, config: tmdbOn(stub) });
  await fillLibrary(filled);
  await filled.dispose();
  const before = snapshot(dataDir);

  const forbidden = await forbiddenTmdb();
  const t = await makeApp({ dataDir, config: tmdbOn(forbidden) });
  const token = (await signIn(t.app)).access;
  const manual = String(pick((await send(t.app, "POST", "/api/titles", { kind: "movie", title: "Mine" }, token)).body, "data.id"));
  const after = snapshot(dataDir);
  for (const url of [
    "/api/titles/movie-603", "/api/titles/tv-1399", "/api/titles/tv-1399/seasons/1", "/api/titles/movie-603/recommendations",
    "/api/titles/tv-1399/recommendations", "/api/titles/genres?kind=movie", "/api/titles/genres?kind=tv", "/api/titles/catalog",
    "/api/titles/movie-424242", "/api/titles/tv-424242/seasons/1", "/api/titles/movie-424242/recommendations",
    `/api/titles/${manual}`, `/api/titles/${manual}/recommendations`, "/api/titles", "/api/titles/search?q=matrix",
  ]) {
    await send(t.app, "GET", url);
    await send(t.app, "GET", url, undefined, token);
  }
  assert.deepEqual(forbidden.calls, [], "no public title route made a TMDB call");
  assert.equal(snapshot(dataDir).includes("Mine"), true, "(the manual title the test made is the only change)");
  assert.notEqual(snapshot(dataDir), before);
  await send(t.app, "DELETE", `/api/titles/${manual}`, undefined, token);
  assert.equal(snapshot(dataDir), before, "the reads wrote nothing");
  assert.ok(after.length > before.length);
  await t.dispose();
  rmSync(dataDir, { recursive: true, force: true });
});

test("a title that is not stored is 404 title.not_found, a series answers season counts and its stored episodes", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: tmdbOn(tmdb) });
  await fillLibrary(t);
  const missing = await send(t.app, "GET", "/api/titles/movie-999999");
  assert.deepEqual([missing.status, pick(missing.body, "error.code")], [404, "title.not_found"]);
  assert.equal((await send(t.app, "GET", "/api/titles/not-an-id")).status, 404);
  const detail = await send(t.app, "GET", "/api/titles/tv-1399");
  assert.deepEqual(pick(detail.body, "data.seasons"), [{ season: 1, episodeCount: 10 }], "counts only, no specials, no empty season");
  const season = await send(t.app, "GET", "/api/titles/tv-1399/seasons/1");
  assert.equal(pick(season.body, "data.episodes.0.title"), "Winter Is Coming");
  assert.equal(pick(season.body, "data.episodes.0.runtimeMs"), 3_720_000);
  assert.deepEqual((await send(t.app, "GET", "/api/titles/tv-1399/seasons/7")).body, { ok: true, data: { episodes: [] } });
  assert.equal((await send(t.app, "GET", "/api/titles/movie-603/seasons/1")).status, 404, "a movie has no seasons");
  assert.equal((await send(t.app, "GET", "/api/titles/tv-999/seasons/1")).status, 404);
  await t.dispose();
});

test("genres are the stored dictionary: empty until a Library fill has run, then TMDB's list as it was read", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: tmdbOn(tmdb) });
  assert.deepEqual((await send(t.app, "GET", "/api/titles/genres?kind=movie")).body, { ok: true, data: [] });
  assert.equal(tmdb.calls.length, 0);
  await fillLibrary(t);
  assert.deepEqual((await send(t.app, "GET", "/api/titles/genres?kind=movie")).body, { ok: true, data: [{ id: 878, name: "Science Fiction" }] });
  assert.deepEqual(pick((await send(t.app, "GET", "/api/titles/genres?kind=tv")).body, "data"), [{ id: 18, name: "Drama" }]);
  await t.dispose();
});

test("a list-only title answers its stored list shape", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: tmdbOn(tmdb) });
  const token = (await signIn(t.app)).access;
  await send(t.app, "PATCH", "/api/jobs/1", { enabled: true, config: { pages: 1 } }, token);
  // A fill that stops after the walk is the same state as a title whose detail has not been fetched yet.
  const db = new DatabaseSync(path.join(t.dataDir, "admin.db"));
  db.prepare("INSERT INTO titles (id, kind, tmdb_id, origin, payload, popularity_score, fetched_at) VALUES (?, ?, ?, 'tmdb', ?, ?, ?)").run(
    "movie-77", "movie", 77, JSON.stringify({ id: "movie-77", tmdbId: 77, kind: "movie", shape: "list", title: "Thin", genres: ["878"] }), 5, 1,
  );
  db.close();
  const thin = await send(t.app, "GET", "/api/titles/movie-77");
  assert.deepEqual(["shape", "title", "state"].map((f) => pick(thin.body, `data.${f}`)), ["list", "Thin", "synced"]);
  assert.equal(tmdb.calls.length, 0);
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
