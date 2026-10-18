// The Library update (docs/49) end to end against a fake TMDB that enforces TMDB's rules: `recent` asks the discover window
// and the vote floor, `changes` asks `[start, today]` (a 422 past 14 days) and forces exactly the stored titles it lists,
// `refresh` has no age clause, and the cursor moves only on an `ok` run.
import assert from "node:assert/strict";
import test from "node:test";

import { pick } from "./test-app.js";
import { DAY_MS, TODAY, daysAgo, updateApp } from "./update-kit.js";
import type { Dated } from "./update-tmdb.js";

const WHEN = Date.UTC(2026, 9, 16, 12);
const HOUR_MS = 60 * 60 * 1000;
const titles = (first: number, count: number): Dated[] =>
  Array.from({ length: count }, (_, i) => ({ id: first + i, date: daysAgo(1 + (i % 60)) }));
const stored = async (f: Awaited<ReturnType<typeof updateApp>>): Promise<number> =>
  Number(pick((await f.api("GET", "/api/titles/stored?limit=1")).body, "data.total"));

test("recent asks each kind for the last 90 days at the vote floor, every page, and stores what the fake lists", async () => {
  const f = await updateApp({ movie: titles(100, 45), tv: titles(200, 7) });
  const job = await f.run();
  assert.deepEqual([job.lastResult, job.lastCounts], ["ok", { titles: 52, detailed: 52, seasons: 14, enriched: 0, changed: 0, stale: 0 }]);
  const { discover } = f.tmdb.log;
  const movie = discover.filter((r) => r.kind === "movie");
  assert.deepEqual(movie.map((r) => r.page), ["1", "2", "3"], "page 1 once, then the rest, to the last");
  assert.deepEqual(discover.filter((r) => r.kind === "tv").map((r) => r.page), ["1"]);
  assert.ok(movie.every((r) => r["primary_release_date.gte"] === daysAgo(90) && r["primary_release_date.lte"] === TODAY));
  assert.ok(discover.filter((r) => r.kind === "tv").every((r) => r["first_air_date.gte"] === daysAgo(90) && r["first_air_date.lte"] === TODAY));
  assert.ok(discover.every((r) => r["vote_count.gte"] === "50" && r.sort_by === "popularity.desc"));
  assert.equal(await stored(f), 52);
});

test("changes forces exactly the stored, enabled, TMDB, not-deleted titles it lists; an unchanged title is left alone", async () => {
  const f = await updateApp({ movie: titles(101, 3), tv: titles(201, 1) });
  await f.run();
  assert.equal(await f.plotOf("movie-101"), "Plot 101 v1");
  assert.equal((await f.api("PATCH", "/api/titles/movie-102", { enabled: false })).status, 200);
  assert.equal((await f.api("DELETE", "/api/titles/movie-103")).status, 200);
  assert.equal((await f.api("POST", "/api/titles", { kind: "movie", title: "Home", tmdbId: 150, plot: "Mine" })).status, 201);
  f.tmdb.state.changed.movie.set(TODAY, [101, 102, 103, 150, 9999]);
  f.tmdb.state.changed.tv.set(TODAY, [201]);
  f.tmdb.state.plot.set(101, "Plot 101 v2");
  f.tmdb.log.details.length = 0;
  f.tmdb.log.changes.length = 0;
  const job = await f.run();
  assert.deepEqual(f.tmdb.log.changes.map((r) => [r.kind, r.start_date, r.end_date]), [["movie", TODAY, TODAY], ["tv", TODAY, TODAY]]);
  assert.deepEqual([...f.tmdb.log.details].sort(), ["movie:detail:101", "tv:detail:201"], "stored ones only, once each");
  assert.equal(pick(job, "lastCounts.changed"), 2);
  assert.equal(await f.plotOf("movie-101"), "Plot 101 v2", "a fresh title was really fetched again");

  // The same changed set again at the same moment: the cursor says nothing new, so only the day's ids come back.
  f.tmdb.state.changed.movie.clear();
  f.tmdb.state.changed.tv.clear();
  f.tmdb.log.details.length = 0;
  const quiet = await f.run();
  assert.deepEqual([f.tmdb.log.details, pick(quiet, "lastCounts.changed"), pick(quiet, "lastCounts.detailed")], [[], 0, 0],
    "an empty changed set widens nothing");
});

test("the recent queue has no age clause: a 10-day-old unchanged detail stays; a list-only title and an episode-less season are fetched", async () => {
  const f = await updateApp({ movie: [{ id: 101, date: daysAgo(5) }, { id: 102, date: daysAgo(5) }], tv: [{ id: 201, date: daysAgo(5) }] });
  f.tmdb.state.fail.set("movie:detail:102", 404);
  f.tmdb.state.noSeasonKey.add("201:2");
  await f.run();
  assert.deepEqual([await f.shapeOf("movie-101"), await f.shapeOf("movie-102")], ["detail", "list"]);
  assert.deepEqual(pick((await f.api("GET", "/api/titles/tv-201/seasons/2")).body, "data.episodes"), []);

  await f.advance(10 * DAY_MS);
  f.tmdb.state.fail.clear();
  f.tmdb.state.noSeasonKey.clear();
  f.tmdb.log.details.length = 0;
  f.tmdb.log.appends.length = 0;
  const again = await f.run();
  assert.deepEqual([...f.tmdb.log.details].sort(), ["movie:detail:102", "tv:detail:201"], "101 is 10 days old and unchanged: not fetched");
  assert.ok(f.tmdb.log.appends.includes("201|season/2"), "the series is asked for its missing season alone");
  assert.equal(pick(again, "lastCounts.seasons"), 1, "season 2 of the series, nothing else");
  assert.equal(pick((await f.api("GET", "/api/titles/tv-201/seasons/2")).body, "data.episodes.0.title"), "E1");
});

test("a changed series gets its newly added episode (the season's count changed, so its episodes are read again)", async () => {
  const f = await updateApp({ tv: [{ id: 201, date: daysAgo(3) }] });
  await f.run();
  const episodes = async (): Promise<number> =>
    (pick((await f.api("GET", "/api/titles/tv-201/seasons/1")).body, "data.episodes") as unknown[]).length;
  assert.equal(await episodes(), 1);
  f.tmdb.state.episodes.set("201:1", 2);
  f.tmdb.state.changed.tv.set(TODAY, [201]);
  await f.run();
  assert.equal(await episodes(), 2);
});

test("the cursor moves only on an ok run (to its start minus an hour); a failed and a stopped run leave it", async () => {
  const f = await updateApp({ movie: titles(101, 2) });
  assert.equal(f.cursor(), null);
  await f.run();
  assert.equal(f.cursor(), WHEN - HOUR_MS);

  await f.advance(HOUR_MS);
  f.tmdb.state.fail.set("movie:changes", 404);
  const failed = await f.run();
  assert.deepEqual([failed.lastResult, f.cursor()], ["failed", WHEN - HOUR_MS], "a failed run leaves it");
  f.tmdb.state.fail.clear();

  const gate = f.tmdb.hold("movie:discover:1");
  await f.api("POST", "/api/jobs/2/run");
  await gate.started;
  await f.api("POST", "/api/jobs/2/stop");
  await f.finished();
  gate.release();
  assert.deepEqual([(await f.job()).lastResult, f.cursor()], ["stopped", WHEN - HOUR_MS], "a stopped run leaves it");

  await f.advance(HOUR_MS);
  await f.run();
  assert.equal(f.cursor(), WHEN + HOUR_MS, "the next ok run (it started at WHEN + 2h): its start minus the overlap");
  const asked = f.tmdb.log.changes.at(-1);
  assert.equal(asked?.start_date, TODAY, "and its window starts at the cursor's day");
});

test("a never-run job and a cursor older than 14 days are clamped to 14 days back and noted; a recent one is not", async () => {
  const f = await updateApp({ movie: titles(101, 1) });
  await f.run();
  assert.deepEqual(f.tmdb.log.changes.map((r) => [r.start_date, r.end_date]), [[daysAgo(14), TODAY], [daysAgo(14), TODAY]]);
  assert.match(String(f.audits().at(-1)?.notes), /no cursor yet.*a Library fill covers more/);

  await f.advance(20 * DAY_MS);
  f.tmdb.log.changes.length = 0;
  const clamped = await f.run();
  assert.equal(clamped.lastResult, "ok", "the fake answers 422 for a longer range: the clamp kept it inside");
  assert.deepEqual(f.tmdb.log.changes.map((r) => r.start_date), [daysAgo(-6), daysAgo(-6)], "14 days before the new today");
  assert.match(String(f.audits().at(-1)?.notes), /older than 14 days/);

  await f.advance(3 * DAY_MS);
  f.tmdb.log.changes.length = 0;
  await f.run();
  assert.equal(f.tmdb.log.changes[0]?.start_date, daysAgo(-20), "inside the limit the window starts at the cursor's day");
  assert.equal(f.audits().at(-1)?.notes, undefined);
});
