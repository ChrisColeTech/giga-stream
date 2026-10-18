// The Library update as a job (docs/49): its config in the Jobs routes, its three phases on the progress stream, and one catalog run at a time (a manual run during a fill is 409 sync.busy).
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
  assert.equal(pick((await f.api("GET", "/api/jobs/2")).body, "data.lastCounts.airing"), 0);
});

test("one run, three phases: recent, then airing, then refresh, each with its own total", async () => {
  const f = await updateApp({ movie: [{ id: 100, date: daysAgo(2) }, { id: 101, date: daysAgo(3) }], tv: [{ id: 200, date: daysAgo(4), aired: TODAY }] });
  const [recent, airing, refresh] = [f.tmdb.hold("tv:discover:1"), f.tmdb.hold("tv:airing:1"), f.tmdb.hold("movie:detail:101")];
  await f.api("POST", "/api/jobs/2/run");
  await recent.started;
  assert.deepEqual(pick(await f.job(), "progress"), { jobId: 2, phase: "recent", done: 0, total: 0 });
  recent.release();
  await airing.started;
  assert.equal(pick(await f.job(), "progress.phase"), "airing");
  airing.release();
  await refresh.started;
  const progress = pick(await f.job(), "progress") as { phase: string; done: number; total: number };
  assert.deepEqual([progress.phase, progress.total, progress.done < progress.total], ["refresh", 3, true], "3 titles queued, the held one not done");
  refresh.release();
  await f.finished();
  assert.equal(pick(await f.job(), "lastResult"), "ok");
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
