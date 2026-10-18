// OMDb enrichment in the Library fill's `details` phase (docs/11 section 7.3, docs/47 section 3.1) against a fake TMDB and a
// fake OMDb: one call per title by IMDb id inside the daily budget, the `omdb` block on the stored detail, no key = no calls,
// a spent budget leaves the rest to the next run, a miss is recorded and waits out the window, Stop mid-call, and public
// reads that call neither service.
import assert from "node:assert/strict";
import test from "node:test";

import { CatalogCountsSchema } from "../src/types/job-counts.js";
import { fakeOmdb, column, omdbConfig } from "./omdb-kit.js";
import { pick } from "./test-app.js";
import { fillApp, walkTmdb, type FillApp } from "./walk-kit.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const ALL = ["tt1010", "tt1011", "tt2010", "tt2011"];
const run = async (f: FillApp): Promise<Record<string, unknown>> => {
  await f.api("POST", "/api/jobs/1/run");
  await f.finished();
  return f.job();
};
/** Every title has an IMDb id and a movie's runtime; TMDB leaves out the overview of the ids in `gapped` (all four by default). */
const withImdb = async (gapped: number[] = [1010, 1011, 2010, 2011]) => {
  const tmdb = await walkTmdb({ movie: 1, tv: 1 });
  tmdb.state.imdb = true;
  tmdb.state.runtime = 100;
  for (const id of gapped) tmdb.state.bare.set(id, ["overview"]);
  return tmdb;
};
const read = async (f: FillApp, id: string, field: string): Promise<unknown> => pick((await f.api("GET", `/api/titles/${id}`)).body, `data.${field}`);

test("the details phase asks OMDb for a gapped title once and fills the gap; the next run asks nobody, and public reads call neither service", async () => {
  const [tmdb, omdb] = [await withImdb(), await fakeOmdb()];
  const f = await fillApp(tmdb, 1, omdbConfig(omdb));
  const job = await run(f);
  assert.deepEqual(job.lastCounts, { titles: 4, detailed: 4, seasons: 4, enriched: 4, airing: 0, stale: 0 });
  assert.deepEqual([...omdb.calls].sort(), ALL, "one call per title, by its IMDb id");
  assert.deepEqual(await Promise.all(["omdb.rated", "omdb.imdbRating", "omdb.ratings.1.source", "omdb.boxOffice", "omdb.director", "imdbId", "plot"]
    .map((k) => read(f, "movie-1010", k))), ["PG-13", "8.7", "Rotten Tomatoes", "$177,559,005", "A Director", "tt1010",
    "A full OMDb plot for tt1010."], "the empty plot is filled from OMDb");
  assert.equal(await read(f, "tv-2010", "omdb.plot"), "A full OMDb plot for tt2010.");

  const [tmdbSeen, omdbSeen] = [tmdb.asked.length, omdb.calls.length];
  await f.api("GET", "/api/titles/movie-1010/recommendations");
  await f.api("GET", "/api/titles/tv-2010/seasons/1");
  await f.api("GET", "/api/titles/genres?kind=movie");
  assert.deepEqual([tmdb.asked.length, omdb.calls.length], [tmdbSeen, omdbSeen], "a read never asks TMDB or OMDb");

  const again = await run(f);
  assert.deepEqual(again.lastCounts, { titles: 4, detailed: 0, seasons: 0, enriched: 0, airing: 0, stale: 0 }, "a fresh block is not asked for again");
  assert.equal(omdb.calls.length, omdbSeen);
});

test("without an OMDb key there are no OMDb calls and the details are stored as before", async () => {
  const [tmdb, omdb] = [await withImdb(), await fakeOmdb()];
  const f = await fillApp(tmdb, 1);
  const job = await run(f);
  assert.deepEqual([pick(job, "lastCounts.detailed"), pick(job, "lastCounts.enriched")], [4, 0]);
  assert.equal(omdb.calls.length, 0);
  assert.deepEqual([await read(f, "movie-1010", "shape"), await read(f, "movie-1010", "imdbId"), await read(f, "movie-1010", "omdb")],
    ["detail", "tt1010", undefined]);
});

test("a spent daily budget ends OMDb for the run while TMDB goes on; the rest is picked up the next day; a disabled title is never asked", async () => {
  const [tmdb, omdb] = [await withImdb(), await fakeOmdb()];
  const f = await fillApp(tmdb, 1, omdbConfig(omdb, 12)); // 12 less the client's headroom of 10: two calls a day
  const first = await run(f);
  assert.deepEqual([pick(first, "lastCounts.detailed"), pick(first, "lastCounts.enriched")], [4, 2], "all four detailed, two enriched");
  assert.deepEqual(omdb.calls, ["tt1011", "tt1010"], "popularity order");
  assert.equal(await read(f, "tv-2010", "shape"), "detail");
  assert.equal(await read(f, "tv-2010", "omdb"), undefined);
  assert.deepEqual(pick((await f.api("GET", "/api/titles/sync")).body, "data.omdb"), { enabled: true, calls: 2, limit: 12 });

  assert.equal((await f.api("PATCH", "/api/titles/tv-2011", { enabled: false })).status, 200);
  assert.equal(pick(await run(f), "lastCounts.enriched"), 0, "the same day: nothing more is asked");
  assert.equal(omdb.calls.length, 2);

  const asked = tmdb.details().length;
  f.t.clock.advance(DAY_MS + 60_000);
  await f.renew();
  const next = await run(f);
  assert.deepEqual([pick(next, "lastCounts.detailed"), pick(next, "lastCounts.enriched")], [0, 1], "no TMDB call; the one enabled title left");
  assert.deepEqual(omdb.calls, ["tt1011", "tt1010", "tt2010"]);
  assert.equal(tmdb.details().length, asked);
  assert.equal(await read(f, "tv-2010", "omdb.rated"), "PG-13");
});

test("OMDb's 'Request limit reached.' or a refused key ends OMDb for the run without failing a title or the run", async () => {
  const [tmdb, omdb] = [await withImdb(), await fakeOmdb()];
  omdb.state.limitAfter = 1;
  const f = await fillApp(tmdb, 1, omdbConfig(omdb));
  const job = await run(f);
  assert.deepEqual([job.lastResult, pick(job, "lastCounts.detailed"), pick(job, "lastCounts.enriched")], ["ok", 4, 1]);
  assert.equal(omdb.calls.length, 2, "the refusal stops the asking");
  assert.equal(column(f.t, "movie-1010", "omdb_failed_at"), null, "a refusal is not the title's miss");

  const wrong = await fillApp(await withImdb(), 1, { ...omdbConfig(omdb), OMDB_API_KEY: "wrong" });
  const before = omdb.calls.length;
  const refused = await run(wrong);
  assert.deepEqual([refused.lastResult, pick(refused, "lastCounts.detailed"), pick(refused, "lastCounts.enriched")], ["ok", 4, 0]);
  assert.equal(omdb.calls.length, before + 1, "one refused call, then none");
});

test("an OMDb miss is recorded and not asked again until the window passes; the other titles are enriched", async () => {
  const [tmdb, omdb] = [await withImdb(), await fakeOmdb()];
  omdb.state.miss.add("tt1010");
  const f = await fillApp(tmdb, 1, omdbConfig(omdb));
  assert.equal(pick(await run(f), "lastCounts.enriched"), 3);
  assert.notEqual(column(f.t, "movie-1010", "omdb_failed_at"), null);
  assert.equal(await read(f, "movie-1010", "omdb"), undefined);
  assert.equal(await read(f, "movie-1010", "shape"), "detail", "the detail itself stands");

  assert.equal(pick(await run(f), "lastCounts.enriched"), 0);
  assert.equal(omdb.calls.length, 4, "the miss is not retried at once");

  f.t.clock.advance(4 * DAY_MS);
  await f.renew();
  const later = await run(f);
  assert.deepEqual([pick(later, "lastCounts.detailed"), pick(later, "lastCounts.enriched")], [4, 3], "TMDB refreshed; blocks older than the window asked again");
  assert.equal(omdb.calls.filter((id) => id === "tt1010").length, 2, "the miss waited out the window, then was asked once more");
  assert.equal(await read(f, "movie-1011", "omdb.rated"), "PG-13", "a refreshed detail keeps its block");
});

test("Stop during an OMDb call ends the run there: the TMDB detail stays, no later title is asked, the next run finishes the job", async () => {
  const [tmdb, omdb] = [await withImdb(), await fakeOmdb()];
  const gate = omdb.hold("tt1011");
  const f = await fillApp(tmdb, 1, omdbConfig(omdb));
  await f.api("POST", "/api/jobs/1/run");
  await gate.started;
  await f.api("POST", "/api/jobs/1/stop");
  await f.finished();
  const stopped = await f.job();
  assert.deepEqual([stopped.lastResult, pick(stopped, "lastCounts.detailed"), pick(stopped, "lastCounts.enriched")], ["stopped", 1, 0]);
  assert.equal(tmdb.details().length, 1, "no title after the held one was asked for");
  assert.deepEqual([await read(f, "movie-1011", "shape"), await read(f, "movie-1011", "omdb")], ["detail", undefined]);

  gate.release();
  const resumed = await run(f);
  assert.deepEqual([resumed.lastResult, pick(resumed, "lastCounts.detailed"), pick(resumed, "lastCounts.enriched")], ["ok", 3, 4]);
  assert.equal(await read(f, "movie-1011", "omdb.rated"), "PG-13");
});

test("a result stored before OMDb came back reads with enriched 0", () => {
  assert.deepEqual(CatalogCountsSchema.parse({ titles: 3, stale: 1 }), { titles: 3, detailed: 0, seasons: 0, enriched: 0, airing: 0, stale: 1 });
});
