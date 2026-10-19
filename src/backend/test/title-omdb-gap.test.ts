// OMDb as a gap filler (docs/11 section 7.3): a title whose TMDB detail has everything makes no OMDb call; a gap (plot, movie
// runtime, genres, rating) makes one and only the empty fields are filled; a present field and an admin-edited one are never
// touched; 'N/A' fills nothing and is no failure. Budget, miss and Stop: title-omdb-sync.test.ts.
import assert from "node:assert/strict";
import test from "node:test";

import { fakeOmdb, column, omdbConfig } from "./omdb-kit.js";
import { pick } from "./test-app.js";
import { fillApp, walkTmdb, type FillApp } from "./walk-kit.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const run = async (f: FillApp): Promise<Record<string, unknown>> => {
  await f.api("POST", "/api/admin/jobs/1/run");
  await f.finished();
  return f.job();
};
const read = async (f: FillApp, id: string, field: string): Promise<unknown> =>
  pick((await f.api("GET", `/api/titles/${id}`)).body, `data.${field}`);
/** A fake TMDB whose details carry an IMDb id and a movie runtime; `bare` says what it leaves out of which id. */
const setup = async (bare: Array<[number, string[]]>) => {
  const tmdb = await walkTmdb({ movie: 1, tv: 1 });
  Object.assign(tmdb.state, { imdb: true, runtime: 100, bare: new Map(bare) });
  const omdb = await fakeOmdb();
  return { tmdb, omdb, f: await fillApp(tmdb, 1, omdbConfig(omdb)) };
};
const enriched = (job: Record<string, unknown>): unknown => pick(job, "lastCounts.enriched");

test("a title with no gap makes no OMDb call, gets no block and is not marked failed", async () => {
  const { omdb, f } = await setup([]);
  const job = await run(f);
  assert.deepEqual([job.lastResult, pick(job, "lastCounts.detailed"), enriched(job)], ["ok", 4, 0]);
  assert.deepEqual(omdb.calls, []);
  assert.deepEqual([await read(f, "movie-1010", "omdb"), await column(f.t, "movie-1010", "omdb_failed_at")], [undefined, null]);
  await run(f);
  assert.deepEqual(omdb.calls, [], "and the next run does not queue it for OMDb alone");
});

test("a gap makes one call and OMDb fills only the empty fields: plot, runtime, rating and the genres TMDB's dictionary knows", async () => {
  const { omdb, f } = await setup([[1010, ["overview", "genres", "vote_average", "runtime"]]]);
  const job = await run(f);
  assert.deepEqual([omdb.calls, enriched(job)], [["tt1010"], 1]);
  assert.deepEqual(await Promise.all(["plot", "genres", "rating", "runtimeMs", "omdb.rated"].map((k) => read(f, "movie-1010", k))),
    ["A full OMDb plot for tt1010.", ["Drama"], 8.7, 7_200_000, "PG-13"], "'Mystery' is not in the dictionary: skipped");
  assert.deepEqual(await Promise.all(["plot", "rating", "omdb"].map((k) => read(f, "movie-1011", k))), ["Plot 1011", 7, undefined]);
});

test("a present field is never replaced: only the plot is empty, so genres, rating and runtime stay TMDB's", async () => {
  const { omdb, f } = await setup([[1010, ["overview"]]]);
  await run(f);
  assert.deepEqual(omdb.calls, ["tt1010"]);
  assert.deepEqual(await Promise.all(["plot", "genres", "rating", "runtimeMs"].map((k) => read(f, "movie-1010", k))),
    ["A full OMDb plot for tt1010.", ["Drama"], 7, 6_000_000]);
});

test("a series without a runtime is not a gap; a series with no plot is", async () => {
  const { omdb, f } = await setup([[2011, ["overview"]]]);
  assert.equal(enriched(await run(f)), 1);
  assert.deepEqual(omdb.calls, ["tt2011"], "tv-2010 has no runtime and no call");
  assert.equal(await read(f, "tv-2011", "plot"), "A full OMDb plot for tt2011.");
});

test("an imdbRating of 'N/A' fills nothing, is no failure, and the title is not asked again", async () => {
  const { omdb, f } = await setup([[1010, ["vote_average"]]]);
  omdb.state.answer = { imdbRating: "N/A" };
  const job = await run(f);
  assert.deepEqual([job.lastResult, enriched(job), omdb.calls], ["ok", 0, ["tt1010"]]);
  assert.deepEqual([await read(f, "movie-1010", "rating"), await column(f.t, "movie-1010", "omdb_failed_at")], [undefined, null]);
  assert.equal(typeof (await read(f, "movie-1010", "omdb.fetchedAt")), "number");
  await run(f);
  assert.equal(omdb.calls.length, 1);
});

test("a rating gap is filled from imdbRating", async () => {
  const { f } = await setup([[1010, ["vote_average"]]]);
  assert.equal(enriched(await run(f)), 1);
  assert.equal(await read(f, "movie-1010", "rating"), 8.7);
});

test("a nulled field reads back as absent or empty, never as a missing title", async () => {
  const { f } = await setup([]);
  await run(f);
  const patch = await f.api("PATCH", "/api/admin/titles/movie-1010", { genres: null, plot: null, rating: null });
  assert.equal(patch.status, 200);
  const shown = await f.api("GET", "/api/titles/movie-1010");
  assert.equal(shown.status, 200);
  assert.deepEqual(["genres", "plot", "rating", "title"].map((k) => pick(shown.body, `data.${k}`)), [[], undefined, undefined, "movie 1010"]);
  const stored = await f.api("GET", "/api/admin/titles/stored?limit=10");
  assert.equal(stored.status, 200);
});

test("an admin-edited field is untouched: emptied genres stay empty while the empty plot beside them is filled", async () => {
  const { omdb, f } = await setup([[1010, ["overview"]]]);
  omdb.state.limitAfter = 0; // the first run: OMDb refuses, the gap stays
  assert.equal(enriched(await run(f)), 0);
  assert.equal((await f.api("PATCH", "/api/admin/titles/movie-1010", { genres: [] })).status, 200);
  omdb.state.limitAfter = undefined;
  f.t.clock.advance(DAY_MS + 60_000);
  await f.renew();
  assert.equal(enriched(await run(f)), 1);
  assert.deepEqual(await Promise.all(["plot", "genres"].map((k) => read(f, "movie-1010", k))),
    ["A full OMDb plot for tt1010.", []]);
});
