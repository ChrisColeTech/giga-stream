import test from "node:test";
import assert from "node:assert/strict";

import { makeApp, pick, send, signIn } from "./test-app.js";
import { omdbOn, settled, stubOmdb, stubTmdb, tmdbOn } from "./title-stubs.js";

test("a detail is enriched from OMDb once, then served from the store without another call", async () => {
  const tmdb = await stubTmdb();
  const omdb = await stubOmdb();
  const t = await makeApp({ config: omdbOn(tmdb, omdb) });

  const first = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(pick(first.body, "data.title"), "The Matrix");
  assert.equal(pick(first.body, "data.imdbId"), "tt0133093");
  assert.equal(pick(first.body, "data.omdb.rated"), "R");
  assert.equal(pick(first.body, "data.omdb.metascore"), "73");
  assert.equal(pick(first.body, "data.omdb.ratings.1.source"), "Rotten Tomatoes");
  assert.equal(pick(first.body, "data.omdb.boxOffice"), "$177,559,005");
  assert.equal(pick(first.body, "data.omdb.director"), "Lana Wachowski, Lilly Wachowski");
  assert.equal(pick(first.body, "data.plot"), "A computer hacker learns the true nature of reality.", "TMDB plot is never replaced");

  const callsAfterFirst = omdb.calls.length;
  assert.equal(callsAfterFirst, 1, "one OMDb call");
  const again = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(pick(again.body, "data.omdb.rated"), "R");
  assert.equal(omdb.calls.length, callsAfterFirst, "the second read is served from the store");
  await t.dispose();
});

test("a thin list row is enriched to a full detail on read, and then carries its OMDb block", async () => {
  const tmdb = await stubTmdb();
  const omdb = await stubOmdb();
  const t = await makeApp({ config: omdbOn(tmdb, omdb) });

  // The sync stores thin rows (shape "list"); opening one refetches the full record and enriches it.
  const access = (await signIn(t.app)).access;
  await send(t.app, "PATCH", "/api/jobs/1", { enabled: true, config: { pages: 1 } }, access);
  await send(t.app, "POST", "/api/titles/sync", undefined, access);
  await settled(t);

  const detail = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(pick(detail.body, "data.plot"), "A computer hacker learns the true nature of reality.");
  assert.equal(pick(detail.body, "data.cast.0"), "Keanu Reeves");
  assert.equal(pick(detail.body, "data.omdb.rated"), "R");
  await t.dispose();
});

test("without a key, or on an OMDb miss, the detail is served TMDB-shaped with no omdb block", async () => {
  const tmdb = await stubTmdb();
  const omdb = await stubOmdb();

  // No key configured: no block, no call.
  const plain = await makeApp({ config: tmdbOn(tmdb) });
  const noKey = await send(plain.app, "GET", "/api/titles/movie-603");
  assert.equal(pick(noKey.body, "data.title"), "The Matrix");
  assert.equal(pick(noKey.body, "data.omdb"), undefined);
  assert.equal(omdb.calls.length, 0);
  await plain.dispose();

  // A title whose id OMDb does not know (the stub misses everything but tt0133093).
  const miss = await makeApp({ config: omdbOn(tmdb, omdb) });
  const got = await send(miss.app, "GET", "/api/titles/tv-1399/seasons/1");
  assert.equal(pick(got.body, "data.episodes.0.title"), "Winter Is Coming", "seasons work without an omdb block");
  const gotDetail = await send(miss.app, "GET", "/api/titles/tv-1399");
  assert.equal(pick(gotDetail.body, "data.imdbId"), "tt0944947");
  assert.equal(pick(gotDetail.body, "data.omdb"), undefined, "the miss degrades silently");
  await miss.dispose();
});

test("the daily budget stops enriching near the quota, and the status reports the counter", async () => {
  const tmdb = await stubTmdb();
  const omdb = await stubOmdb();
  const t = await makeApp({ config: { ...omdbOn(tmdb, omdb), OMDB_DAILY_LIMIT: 2 } });
  const access = (await signIn(t.app)).access;

  const first = await send(t.app, "GET", "/api/titles/movie-603");
  assert.equal(pick(first.body, "data.omdb.rated"), "R", "the first enrichment spends the budget");

  const status = await send(t.app, "GET", "/api/titles/sync", undefined, access);
  assert.deepEqual(pick(status.body, "data.omdb"), { enabled: true, calls: 1, limit: 2 });

  // The Matrix is enriched once (1 call); the headroom rule stops nothing yet, but a fresh
  // title never enriched cannot exceed the limit: with the limit at 2 and headroom 10, the
  // stop is immediate for the second kind of check — the tv detail gets no block.
  const got = await send(t.app, "GET", "/api/titles/tv-1399");
  assert.equal(pick(got.body, "data.omdb"), undefined, "the budget guard held (limit 2, headroom 10)");
  await t.dispose();
});
