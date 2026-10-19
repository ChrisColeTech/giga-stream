// The Library fill's `details` phase (docs/47 section 3.1) against a fake TMDB: popularity order, Stop between titles and
// resuming by query, per-title failures with the three-strike skip, edited titles kept, and a series' seasons
// riding its detail call through append_to_response.
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";


import { DATABASE_FILE_NAME } from "../src/constants/deployment.js";
import { openTestDatabase, queryRow } from "./db-kit.js";
import { until } from "./playlist-kit.js";
import { pick } from "./test-app.js";
import { stubOmdb } from "./title-stubs.js";
import { fillApp, walkTmdb, type FillApp } from "./walk-kit.js";

const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;
const run = async (f: FillApp): Promise<Record<string, unknown>> => {
  await f.api("POST", "/api/admin/jobs/1/run");
  await f.finished();
  return f.job();
};
const failures = async (f: FillApp, id: string): Promise<unknown> => {
  const db = await openTestDatabase(path.join(f.t.dataDir, DATABASE_FILE_NAME));
  try {
    return (await queryRow(db, "SELECT detail_failures AS n FROM titles WHERE id = ?", [id]))?.n;
  } finally {
    db.close();
  }
};
const shapeOf = async (f: FillApp, id: string): Promise<unknown> => pick((await f.api("GET", `/api/titles/${id}`)).body, "data.shape");

test("details are fetched by popularity, highest first, then by id; counts say what the run did", async () => {
  const tmdb = await walkTmdb({ movie: 2, tv: 1 });
  const f = await fillApp(tmdb, 2);
  const job = await run(f);
  assert.deepEqual([...new Set(tmdb.details())], [
    "movie:detail:1021", "movie:detail:1020", "movie:detail:1011", "movie:detail:1010", "tv:detail:2011", "tv:detail:2010",
  ]);
  assert.deepEqual(job.lastCounts, { titles: 6, detailed: 6, seasons: 4, enriched: 0, airing: 0, stale: 0 });
  assert.deepEqual(await shapeOf(f, "movie-1010"), "detail");
});

test("Stop between titles keeps what was written; running again continues with the titles still list-only", async () => {
  const tmdb = await walkTmdb({ movie: 2, tv: 1 });
  const f = await fillApp(tmdb, 2);
  const gate = tmdb.hold("movie", "detail:1011");
  await f.api("POST", "/api/admin/jobs/1/run");
  await gate.started;
  await f.api("POST", "/api/admin/jobs/1/stop");
  await f.finished();
  const stopped = await f.job();
  assert.deepEqual([stopped.lastResult, pick(stopped, "lastCounts.detailed")], ["stopped", 2]);
  assert.deepEqual([await shapeOf(f, "movie-1021"), await shapeOf(f, "movie-1020"), await shapeOf(f, "movie-1011")], ["detail", "detail", "list"]);
  assert.equal(tmdb.details().length, 3, "no title after the held one was asked for");

  gate.release();
  const before = tmdb.details().length;
  const resumed = await run(f);
  assert.deepEqual([resumed.lastResult, pick(resumed, "lastCounts.detailed")], ["ok", 4]);
  assert.deepEqual([...new Set(tmdb.details().slice(before))], ["movie:detail:1011", "movie:detail:1010", "tv:detail:2011", "tv:detail:2010"],
    "the two stored details are not fetched again");
  assert.deepEqual((await run(f)).lastCounts, { titles: 6, detailed: 0, seasons: 0, enriched: 0, airing: 0, stale: 0 }, "nothing is left to fetch");
});

test("a title TMDB 404s is recorded and the run goes on; three failed runs in a row skip it until its payload changes", async () => {
  const tmdb = await walkTmdb({ movie: 2, tv: 1 });
  tmdb.state.fail.set("movie:detail:1021", 404);
  const f = await fillApp(tmdb, 2);
  const first = await run(f);
  assert.deepEqual([first.lastResult, pick(first, "lastCounts.detailed")], ["ok", 5], "the other five were detailed");
  assert.deepEqual([await shapeOf(f, "movie-1021"), await failures(f, "movie-1021")], ["list", 1]);
  await run(f);
  await run(f);
  assert.equal(await failures(f, "movie-1021"), 3);
  const asked = (): number => tmdb.details().filter((d) => d === "movie:detail:1021").length;
  assert.equal(asked(), 3);
  await run(f);
  assert.equal(asked(), 3, "the fourth run skips it");

  // The same list row again, even when it is stale: nothing changed, so it stays skipped.
  f.t.clock.advance(FOUR_DAYS_MS);
  await f.renew();
  await run(f);
  assert.equal(asked(), 3);
  // TMDB's row changed (a new rating): the payload changed, so it is tried again.
  tmdb.state.rating = 9.9;
  f.t.clock.advance(FOUR_DAYS_MS);
  await f.renew();
  await run(f);
  assert.equal(asked(), 4);
  assert.equal(await failures(f, "movie-1021"), 1);
});

test("an edited title keeps its edits, a manual title is never fetched, and a removed title does not stop the others", async () => {
  const tmdb = await walkTmdb({ movie: 1, tv: 1 });
  tmdb.state.fail.set("movie:detail:1010", 404);
  const f = await fillApp(tmdb, 1);
  await run(f);
  const edited = await f.api("PATCH", "/api/admin/titles/movie-1010", { title: "My own title", plot: "My plot" });
  assert.equal(edited.status, 200, "a list-only stored title can be edited");
  const manual = await f.api("POST", "/api/admin/titles", { kind: "movie", title: "Home", tmdbId: 1011, plot: "Mine" });
  assert.equal(manual.status, 201);
  tmdb.state.fail.delete("movie:detail:1010");
  const before = tmdb.details().length;
  await run(f);
  assert.deepEqual(tmdb.details().slice(before), ["movie:detail:1010"], "only the list-only title; the manual one is not asked for");
  const detail = (await f.api("GET", "/api/titles/movie-1010")).body;
  assert.deepEqual(["shape", "title", "plot", "state"].map((k) => pick(detail, `data.${k}`)), ["detail", "My own title", "My plot", "edited"]);
  assert.equal(pick((await f.api("GET", `/api/titles/${pick(manual.body, "data.id")}`)).body, "data.plot"), "Mine");
});

test("a title without an IMDb id gets no OMDb call (the enrichment itself: title-omdb-sync.test.ts)", async () => {
  const omdb = await stubOmdb();
  const f = await fillApp(await walkTmdb({ movie: 1, tv: 1 }), 1, { OMDB_API_KEY: "omdb-test-key", OMDB_BASE: omdb.base });
  await run(f);
  assert.equal(omdb.calls.length, 0);
});

test("a series' seasons ride TMDB's append_to_response: a never-seen series is ONE call, and so is a refresh", async () => {
  const tmdb = await walkTmdb({ movie: 1, tv: 1 });
  const f = await fillApp(tmdb, 1);
  await run(f);
  const mine = (): string[] => tmdb.appends.filter((a) => a.startsWith("2010|"));
  const blind = `2010|credits,external_ids,${Array.from({ length: 18 }, (_, i) => `season/${i + 1}`).join(",")}`;
  assert.deepEqual(mine(), [blind], "seasons 1 to 18 blind, never season 0; the fake answers only the keys that exist");
  f.t.clock.advance(FOUR_DAYS_MS);
  await f.renew();
  await run(f);
  assert.deepEqual(mine().slice(1), ["2010|credits,external_ids,season/1,season/2"], "a refresh asks for the known seasons");
  const detail = (await f.api("GET", "/api/titles/tv-2010")).body;
  assert.deepEqual(pick(detail, "data.seasons"), [{ season: 1, episodeCount: 1 }, { season: 2, episodeCount: 1 }]);
  for (const n of [1, 2]) {
    assert.equal(pick((await f.api("GET", `/api/titles/tv-2010/seasons/${n}`)).body, "data.episodes.0.title"), `Episode 2010/${n}`);
  }
  assert.deepEqual(pick((await f.api("GET", "/api/titles/tv-2010/seasons/0")).body, "data.episodes"), []);
});

test("a series with 36 seasons is one call and one follow-up of season appends only", async () => {
  const tmdb = await walkTmdb({ movie: 1, tv: 1 });
  tmdb.state.seasonCount = 36;
  const f = await fillApp(tmdb, 1);
  const job = await run(f);
  const mine = tmdb.appends.filter((a) => a.startsWith("2010|")).map((a) => a.split("|")[1]?.split(",") ?? []);
  assert.equal(pick(job, "lastCounts.seasons"), 36 + 36, "both series, every season");
  assert.deepEqual(mine.map((a) => a.length), [20, 18], "credits, external_ids and seasons 1-18, then seasons 19-36");
  assert.equal(mine[1]?.[0], "season/19");
  assert.equal(mine[1]?.at(-1), "season/36");
  f.t.clock.advance(FOUR_DAYS_MS);
  await f.renew();
  const before = tmdb.appends.length;
  await run(f);
  const refresh = tmdb.appends.slice(before).filter((a) => a.startsWith("2010|")).map((a) => a.split("|")[1]?.split(",").length);
  assert.deepEqual(refresh, [20, 18], "a refresh: the same two calls");
  assert.equal(pick((await f.api("GET", "/api/titles/tv-2010/seasons/36")).body, "data.episodes.0.title"), "Episode 2010/36");
});

test("a season TMDB leaves out of its answer stays empty and only that season is asked for on the next run", async () => {
  const tmdb = await walkTmdb({ movie: 1, tv: 1 });
  tmdb.state.noSeasonKey.add("2010:2");
  const f = await fillApp(tmdb, 1);
  assert.equal((await run(f)).lastResult, "ok");
  assert.deepEqual(pick((await f.api("GET", "/api/titles/tv-2010/seasons/2")).body, "data.episodes"), []);
  assert.equal(pick((await f.api("GET", "/api/titles/tv-2010/seasons/1")).body, "data.episodes.0.title"), "Episode 2010/1");

  tmdb.state.noSeasonKey.clear();
  const before = tmdb.appends.length;
  const again = await run(f);
  assert.deepEqual(tmdb.appends.slice(before), ["2010|season/2"], "season 2 alone, with no credits, and no other title");
  assert.equal(pick(again, "lastCounts.seasons"), 1);
  assert.equal(pick((await f.api("GET", "/api/titles/tv-2010/seasons/2")).body, "data.episodes.0.title"), "Episode 2010/2");
  const settled = tmdb.appends.length;
  await run(f);
  assert.equal(tmdb.appends.length, settled, "nothing left to ask");
});

test("the progress total of the details phase is the titles still needing detail when it starts", async () => {
  const tmdb = await walkTmdb({ movie: 2, tv: 1 });
  const f = await fillApp(tmdb, 2);
  const gate = tmdb.hold("movie", "detail:1020");
  await f.api("POST", "/api/admin/jobs/1/run");
  await gate.started;
  await until(async () => pick(await f.job(), "progress.phase") === "details", "the details phase");
  assert.deepEqual(pick(await f.job(), "progress"), { jobId: 1, phase: "details", done: 1, total: 6 });
  gate.release();
  await f.finished();
  const next = await run(f);
  assert.equal(pick(next, "progress"), undefined);
});
