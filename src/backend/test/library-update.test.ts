// The Library update (docs/49 v3) end to end against a fake TMDB: `recent` asks the discover window and the vote floor,
// `airing` asks the series with an episode in `[start, today]`, forces the ones already stored and stores the new ones
// list-shaped, `refresh` has no age clause, the cursor moves only on an `ok` run, and `/changes` is never requested.
import assert from "node:assert/strict";
import test from "node:test";

import { pick } from "./test-app.js";
import { DAY_MS, TODAY, daysAgo, updateApp, type UpdateApp } from "./update-kit.js";
import type { Dated } from "./update-tmdb.js";

const WHEN = Date.UTC(2026, 9, 16, 12);
const HOUR_MS = 60 * 60 * 1000;
const titles = (first: number, count: number): Dated[] =>
  Array.from({ length: count }, (_, i) => ({ id: first + i, date: daysAgo(1 + (i % 60)) }));
const stored = async (f: UpdateApp): Promise<number> => Number(pick((await f.api("GET", "/api/admin/titles/stored?limit=1")).body, "data.total"));
const airing = (f: UpdateApp) => f.tmdb.log.discover.filter((r) => r["air_date.gte"] !== undefined);
const reset = (f: UpdateApp): void => {
  f.tmdb.log.details.length = 0;
  f.tmdb.log.appends.length = 0;
  f.tmdb.log.discover.length = 0;
};

test("recent asks each kind for the last 90 days at the vote floor, every page; airing asks series only; no /changes", async () => {
  const f = await updateApp({ movie: titles(100, 45), tv: titles(200, 7) });
  const job = await f.run();
  assert.deepEqual([job.lastResult, job.lastCounts], ["ok", { titles: 52, detailed: 52, seasons: 14, enriched: 0, airing: 0, stale: 0 }]);
  const recent = f.tmdb.log.discover.filter((r) => r["air_date.gte"] === undefined);
  const movie = recent.filter((r) => r.kind === "movie");
  assert.deepEqual(movie.map((r) => r.page), ["1", "2", "3"], "page 1 once, then the rest, to the last");
  assert.deepEqual(recent.filter((r) => r.kind === "tv").map((r) => r.page), ["1"]);
  assert.ok(movie.every((r) => r["primary_release_date.gte"] === daysAgo(90) && r["primary_release_date.lte"] === TODAY));
  assert.ok(recent.filter((r) => r.kind === "tv").every((r) => r["first_air_date.gte"] === daysAgo(90) && r["first_air_date.lte"] === TODAY));
  assert.ok(recent.every((r) => r["vote_count.gte"] === "50" && r.sort_by === "popularity.desc"));
  assert.deepEqual(airing(f).map((r) => [r.kind, r["air_date.gte"], r["air_date.lte"], r["vote_count.gte"], r.sort_by]),
    [["tv", daysAgo(14), TODAY, "50", "popularity.desc"]], "series only, no cursor: 14 days back to today");
  assert.equal(await stored(f), 52);
  assert.ok(f.tmdb.log.paths.every((path) => !path.includes("changes")), "/changes is never asked");
});

test("airing forces the stored series in the window and stores a new one list-shaped, then detailed; movies are never forced", async () => {
  const data = {
    movie: titles(101, 3),
    tv: [{ id: 201, date: daysAgo(30), aired: daysAgo(20) }, { id: 202, date: daysAgo(40), aired: daysAgo(2) }, { id: 203, date: daysAgo(100), aired: daysAgo(1) }],
  };
  const f = await updateApp(data);
  const first = await f.run();
  assert.equal(pick(first, "lastCounts.airing"), 1, "202 was stored by recent and aired in the window; 203 was new");
  assert.deepEqual([await f.shapeOf("tv-202"), await f.shapeOf("tv-203")], ["detail", "detail"], "the new series was detailed by the refresh");
  assert.equal(await stored(f), 6);

  // 202 aired a new episode today and TMDB changed its plot: the stored series is fetched again although its detail is fresh.
  data.tv[1] = { id: 202, date: daysAgo(40), aired: TODAY };
  f.tmdb.state.plot.set(202, "Plot 202 v2");
  assert.equal((await f.api("PATCH", "/api/admin/titles/tv-201", { enabled: false })).status, 200);
  data.tv[0] = { id: 201, date: daysAgo(30), aired: TODAY };
  reset(f);
  const job = await f.run();
  assert.deepEqual(airing(f).map((r) => [r["air_date.gte"], r["air_date.lte"]]), [[TODAY, TODAY]], "from the cursor's day");
  assert.deepEqual(f.tmdb.log.details, ["tv:detail:202"], "forced once; the disabled 201 and every movie are left alone");
  assert.equal(pick(job, "lastCounts.airing"), 1);
  assert.equal(await f.plotOf("tv-202"), "Plot 202 v2");

  // Nothing airs: nothing is fetched, nothing is forced.
  data.tv[1] = { id: 202, date: daysAgo(40), aired: daysAgo(30) };
  reset(f);
  const quiet = await f.run();
  assert.deepEqual([f.tmdb.log.details, pick(quiet, "lastCounts.airing"), pick(quiet, "lastCounts.detailed")], [[], 0, 0]);
});

test("a deleted series that is airing stays out of the store and is not refreshed", async () => {
  const data = { movie: [], tv: [{ id: 201, date: daysAgo(5), aired: daysAgo(1) }, { id: 202, date: daysAgo(5), aired: daysAgo(1) }] };
  const f = await updateApp(data);
  await f.run();
  assert.equal((await f.api("DELETE", "/api/admin/titles/tv-202")).status, 200);
  for (const series of data.tv) series.aired = TODAY; // the fake reads this same array
  reset(f);
  const job = await f.run();
  assert.deepEqual([f.tmdb.log.details, pick(job, "lastCounts.airing")], [["tv:detail:201"], 1]);
  assert.equal(await stored(f), 1);
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
  reset(f);
  const again = await f.run();
  assert.deepEqual([...f.tmdb.log.details].sort(), ["movie:detail:102", "tv:detail:201"], "101 is 10 days old and unchanged: not fetched");
  assert.ok(f.tmdb.log.appends.includes("201|season/2"), "the series is asked for its missing season alone");
  assert.equal(pick(again, "lastCounts.seasons"), 1, "season 2 of the series, nothing else");
});

test("an airing series gets its newly added episode (the season's count changed, so its episodes are read again)", async () => {
  const data = { movie: [], tv: [{ id: 201, date: daysAgo(3), aired: daysAgo(40) }] };
  const f = await updateApp(data);
  await f.run();
  const episodes = async (): Promise<number> =>
    (pick((await f.api("GET", "/api/titles/tv-201/seasons/1")).body, "data.episodes") as unknown[]).length;
  assert.equal(await episodes(), 1);
  f.tmdb.state.episodes.set("201:1", 2);
  data.tv[0] = { id: 201, date: daysAgo(3), aired: TODAY };
  await f.run();
  assert.equal(await episodes(), 2);
});

test("the cursor moves only on an ok run (to its start minus an hour); a failed and a stopped run leave it", async () => {
  const f = await updateApp({ movie: titles(101, 2) });
  assert.equal(await f.cursor(), null);
  await f.run();
  assert.equal(await f.cursor(), WHEN - HOUR_MS);

  await f.advance(HOUR_MS);
  f.tmdb.state.fail.set("tv:discover", 404);
  const failed = await f.run();
  assert.deepEqual([failed.lastResult, await f.cursor()], ["failed", WHEN - HOUR_MS], "a failed run leaves it");
  f.tmdb.state.fail.clear();

  const gate = f.tmdb.hold("movie:discover:1");
  await f.api("POST", "/api/admin/jobs/2/run");
  await gate.started;
  await f.api("POST", "/api/admin/jobs/2/stop");
  await f.finished();
  gate.release();
  assert.deepEqual([(await f.job()).lastResult, await f.cursor()], ["stopped", WHEN - HOUR_MS], "a stopped run leaves it");

  await f.advance(HOUR_MS);
  reset(f);
  await f.run();
  assert.equal(await f.cursor(), WHEN + HOUR_MS, "the next ok run (it started at WHEN + 2h): its start minus the overlap");
  assert.equal(airing(f)[0]?.["air_date.gte"], TODAY, "and its airing window starts at the cursor's day");
});

test("no cursor looks 14 days back; a cursor older than 60 days is clamped to 60 days and noted; a recent one is not", async () => {
  const f = await updateApp({ movie: titles(101, 1) });
  await f.run();
  assert.equal(airing(f)[0]?.["air_date.gte"], daysAgo(14));
  assert.equal((await f.audits()).at(-1)?.notes, undefined);

  await f.advance(70 * DAY_MS);
  reset(f);
  assert.equal((await f.run()).lastResult, "ok");
  assert.equal(airing(f)[0]?.["air_date.gte"], daysAgo(-10), "60 days before the new today (70 days on)");
  assert.match(String((await f.audits()).at(-1)?.notes), /older than 60 days/);

  await f.advance(3 * DAY_MS);
  reset(f);
  await f.run();
  assert.equal(airing(f)[0]?.["air_date.gte"], daysAgo(-70), "inside the limit the window starts at the cursor's day");
  assert.equal((await f.audits()).at(-1)?.notes, undefined);
});
