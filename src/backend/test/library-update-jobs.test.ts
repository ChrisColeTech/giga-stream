// The Library update as a job (docs/49): its config in the Jobs routes, its three phases on the progress stream, a window TMDB
// pages only to 500 halved, and one catalog run at a time (a manual run during a fill is 409 sync.busy).
import assert from "node:assert/strict";
import test from "node:test";

import { pick } from "./test-app.js";
import { TODAY, daysAgo, updateApp } from "./update-kit.js";
import { fillApp, walkTmdb } from "./walk-kit.js";

const created = { type: "catalog", name: "Mine" };

test("a recent job's config round-trips: pages is stored as 1 and ignored, kind is dropped, the list still loads", async () => {
  const f = await updateApp({});
  const made = await f.api("POST", "/api/jobs", { ...created, config: { scope: "recent", kind: "movie", pages: 40 } });
  assert.deepEqual([made.status, pick(made.body, "data.config")], [201, { scope: "recent", pages: 1 }]);
  const list = pick((await f.api("GET", "/api/jobs")).body, "data.items") as Array<Record<string, unknown>>;
  assert.deepEqual(list.map((j) => pick(j, "config.scope")), ["discover", "recent", "recent"]);
  const id = pick(made.body, "data.id");
  const popular = await f.api("PATCH", `/api/jobs/${id}`, { config: { scope: "popular", kind: "tv", pages: 7 } });
  assert.deepEqual(pick(popular.body, "data.config"), { scope: "popular", kind: "tv", pages: 7 });
  const back = await f.api("PATCH", `/api/jobs/${id}`, { config: { scope: "recent" } });
  assert.deepEqual(pick(back.body, "data.config"), { scope: "recent", pages: 1 });
  const refused = await f.api("POST", "/api/jobs", { ...created, config: { scope: "recent", pages: 501 } });
  assert.deepEqual([refused.status, pick(refused.body, "error.details.field")], [422, "config.pages"]);
  assert.equal((await f.run()).lastResult, "ok");
  assert.equal(pick((await f.api("GET", "/api/jobs/2")).body, "data.lastCounts.changed"), 0);
});

test("one run, three phases: recent, then changes, then refresh, each with its own total", async () => {
  const f = await updateApp({ movie: [{ id: 100, date: daysAgo(2) }, { id: 101, date: daysAgo(3) }], tv: [{ id: 200, date: daysAgo(4) }] });
  const [recent, changes, refresh] = [f.tmdb.hold("tv:discover:1"), f.tmdb.hold("movie:changes:1"), f.tmdb.hold("movie:detail:101")];
  await f.api("POST", "/api/jobs/2/run");
  await recent.started;
  assert.deepEqual(pick(await f.job(), "progress"), { jobId: 2, phase: "recent", done: 0, total: 0 });
  recent.release();
  await changes.started;
  assert.equal(pick(await f.job(), "progress.phase"), "changes");
  changes.release();
  await refresh.started;
  const progress = pick(await f.job(), "progress") as { phase: string; done: number; total: number };
  assert.deepEqual([progress.phase, progress.total, progress.done < progress.total], ["refresh", 3, true], "3 titles queued, the held one not done");
  refresh.release();
  await f.finished();
  assert.equal(pick(await f.job(), "lastResult"), "ok");
});

test("a window over 500 pages is halved: no page above 500 is asked, no window exceeds 14 days, every day is read to its end", async () => {
  const f = await updateApp({});
  f.tmdb.state.bulk.movie.set(TODAY, 26_000);
  f.tmdb.state.bulk.movie.set(daysAgo(1), 26_000);
  const job = await f.run();
  assert.equal(job.lastResult, "ok", "the fake answers a 400 past page 500 and a 422 past 14 days");
  const movie = f.tmdb.log.changes.filter((r) => r.kind === "movie");
  assert.ok(movie.every((r) => Number(r.page) <= 500));
  for (const day of [TODAY, daysAgo(1)]) {
    const pages = movie.filter((r) => r.start_date === day && r.end_date === day).map((r) => Number(r.page));
    assert.deepEqual(pages, Array.from({ length: 260 }, (_, i) => i + 1), `${day}: all 260 pages, once`);
  }
});

test("a manual run of the update during the Library fill is 409 sync.busy; the fill goes on", async () => {
  const tmdb = await walkTmdb({ movie: 1, tv: 1 });
  const fill = await fillApp(tmdb, 1);
  const gate = tmdb.hold("movie", 1);
  await fill.api("POST", "/api/jobs/1/run");
  await gate.started;
  const busy = await fill.api("POST", "/api/jobs/2/run");
  assert.deepEqual([busy.status, pick(busy.body, "error.code")], [409, "sync.busy"]);
  await fill.api("POST", "/api/jobs/1/stop");
  gate.release();
  await fill.finished();
  assert.equal(pick(await fill.job(), "lastResult"), "stopped");
});
