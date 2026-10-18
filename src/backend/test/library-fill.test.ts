// The Library fill against a fake TMDB (docs/44 sections 3.2 and 3.5): the discover walk with progress, an early
// total_pages, Stop between pages and during a backoff sleep, an error mid-walk (typed, rows kept), a stored detail kept.
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { DATABASE_FILE_NAME } from "../src/constants/deployment.js";
import { fractionOf } from "../src/services/job-progress.js";
import { until } from "./playlist-kit.js";
import { openEvents } from "./sse-kit.js";
import { pick } from "./test-app.js";
import { fillApp, walkTmdb } from "./walk-kit.js";

const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;

test("Run job walks both kinds, ends each at TMDB's total_pages, and streams progress that never goes backwards", async () => {
  const tmdb = await walkTmdb({ movie: 3, tv: 2 });
  const f = await fillApp(tmdb, 5);
  const stream = await openEvents(f.base, f.token());
  await stream.waitFor((frames) => frames.length > 0, "the snapshot");
  assert.equal((await f.api("POST", "/api/jobs/1/run")).status, 202);
  await f.finished();
  await stream.waitFor((frames) => frames.some((x) => x.event === "finished"), "the finished event");

  assert.deepEqual(tmdb.pages(), ["movie:1", "movie:2", "movie:3", "tv:1", "tv:2"], "5 pages of the 10 the cap allowed");
  const job = await f.job();
  assert.deepEqual([job.lastResult, pick(job, "lastCounts.titles"), job.running, job.progress], ["ok", 10, false, undefined]);
  assert.equal(await f.stored(), 10);

  const frames = stream.frames();
  assert.deepEqual(frames.map((x) => x.event).filter((e, i, all) => e !== all[i - 1]), ["snapshot", "progress", "finished"]);
  assert.deepEqual(frames[0]?.data, { running: [] });
  const progress = frames.filter((x) => x.event === "progress").map((x) => x.data as { phase: string; done: number; total: number });
  const fractions = progress.map(fractionOf);
  assert.deepEqual(fractions, [...fractions].sort((a, b) => a - b), "the bar never goes backwards");
  assert.equal(fractions.at(-1), 1);
  assert.deepEqual(progress.filter((p) => p.phase === "movies").map((p) => p.total), [0, 5, 3, 3],
    "the total starts at the cap and is lowered to TMDB's 3 pages once the first page answers");
  assert.deepEqual(progress.at(-1), { jobId: 1, phase: "tv", done: 2, total: 2 });
  assert.deepEqual(frames.at(-1)?.data, { jobId: 1, lastResult: "ok", lastRunAt: job.lastRunAt });
  stream.destroy();
});

test("a running job carries its progress on GET /api/jobs and GET /api/jobs/:id, and the stream's snapshot", async () => {
  const tmdb = await walkTmdb({ movie: 3, tv: 3 });
  const f = await fillApp(tmdb, 3);
  const gate = tmdb.hold("movie", 2);
  await f.api("POST", "/api/titles/sync");
  await gate.started;
  const running = await f.job();
  assert.deepEqual([running.running, running.progress], [true, { jobId: 1, phase: "movies", done: 1, total: 3 }]);
  const list = pick((await f.api("GET", "/api/jobs")).body, "data.items") as Array<Record<string, unknown>>;
  assert.deepEqual(list.find((j) => j.id === 1)?.progress, { jobId: 1, phase: "movies", done: 1, total: 3 });
  const late = await openEvents(f.base, f.token());
  await late.waitFor((frames) => frames.length > 0, "the snapshot");
  assert.deepEqual(late.frames()[0]?.data, { running: [{ jobId: 1, phase: "movies", done: 1, total: 3 }] });
  gate.release();
  await f.finished();
  await late.waitFor((frames) => frames.some((x) => x.event === "finished"), "the finished event");
  late.destroy();
});

test("Stop between pages ends the run stopped with the rows seen kept, audited sync.stopped, and the walk does not go on", async () => {
  const tmdb = await walkTmdb({ movie: 4, tv: 4 });
  const f = await fillApp(tmdb, 4);
  const gate = tmdb.hold("movie", 2);
  await f.api("POST", "/api/jobs/1/run");
  await gate.started;
  const stopped = await f.api("POST", "/api/jobs/1/stop");
  assert.deepEqual([stopped.status, pick(stopped.body, "data.running")], [202, true]);
  await f.finished();
  const job = await f.job();
  assert.deepEqual([job.lastResult, job.lastCounts], ["stopped", { titles: 2, stale: 0, stopped: true }]);
  assert.equal(await f.stored(), 2, "page one stays");
  gate.release();
  assert.deepEqual(tmdb.pages(), ["movie:1", "movie:2"], "no further page and no series");
  const status = pick((await f.api("GET", "/api/titles/sync")).body, "data");
  assert.deepEqual([pick(status, "running"), pick(status, "lastOutcome")], [false, "stopped"]);
  const actions = (pick((await f.api("GET", "/api/audit?limit=20")).body, "data.items") as Array<Record<string, unknown>>).map((e) => e.action);
  assert.ok(actions.includes("sync.stopped") && actions.includes("job.stopped") && !actions.includes("sync.finished"), actions.join());
  assert.equal((await f.api("POST", "/api/jobs/1/stop")).status, 409, "idle again");
  const again = await f.api("POST", "/api/jobs/1/run");
  assert.equal(again.status, 202, "running again re-walks from page 1");
  await f.finished();
  assert.equal(tmdb.pages().filter((p) => p === "movie:1").length, 2);
});

test("Stop during a backoff sleep ends the run at once: the failing page is not asked again", async () => {
  const tmdb = await walkTmdb({ movie: 4, tv: 4 });
  tmdb.state.fail.set("movie:2", 503);
  const f = await fillApp(tmdb, 4);
  await f.api("POST", "/api/jobs/1/run");
  await until(() => tmdb.pages().includes("movie:2"), "the failing page");
  await new Promise((resolve) => setTimeout(resolve, 50)); // into the 2.5 s backoff sleep
  const started = Date.now();
  await f.api("POST", "/api/jobs/1/stop");
  await f.finished();
  assert.ok(Date.now() - started < 1_500, "it did not wait out the backoff");
  assert.equal((await f.job()).lastResult, "stopped");
  assert.equal(tmdb.pages().filter((p) => p === "movie:2").length, 1, "no retry after the stop");
});

test("an error mid-walk is a typed failure with its code, and the rows already written stay", async () => {
  const tmdb = await walkTmdb({ movie: 4, tv: 4 });
  tmdb.state.fail.set("movie:3", 400);
  const f = await fillApp(tmdb, 4);
  await f.api("POST", "/api/jobs/1/run");
  await f.finished();
  const job = await f.job();
  assert.deepEqual([job.lastResult, job.lastCounts], ["failed", { code: "tmdb.unavailable" }]);
  assert.equal(await f.stored(), 4, "pages one and two are kept");
  assert.equal(pick((await f.api("GET", "/api/titles/sync")).body, "data.lastOutcome"), "tmdb.unavailable");
  const entries = pick((await f.api("GET", "/api/audit?limit=20")).body, "data.items") as Array<Record<string, unknown>>;
  const failed = entries.find((e) => e.action === "sync.failed");
  assert.deepEqual([pick(failed, "detail.code"), pick(failed, "detail.titles")], ["tmdb.unavailable", 4]);
});

test("POST /api/titles/sync with no Library fill is 409 job.no_library_fill", async () => {
  const f = await fillApp(await walkTmdb({ movie: 1, tv: 1 }), 1);
  await f.api("DELETE", "/api/jobs/1");
  const refused = await f.api("POST", "/api/titles/sync");
  assert.deepEqual([refused.status, pick(refused.body, "error.code")], [409, "job.no_library_fill"]);
});

test("a stale stored full detail is kept when a thin list row arrives: only the rating and images refresh", async () => {
  const tmdb = await walkTmdb({ movie: 1, tv: 1 });
  const f = await fillApp(tmdb, 1);
  await f.api("POST", "/api/jobs/1/run");
  await f.finished();
  assert.equal((await f.api("GET", "/api/titles/movie-1010")).status, 200, "opening it stores the full detail");
  const row = (): { payload: Record<string, unknown>; fetched_at: number } => {
    const db = new DatabaseSync(path.join(f.t.dataDir, DATABASE_FILE_NAME), { readOnly: true });
    try {
      const found = db.prepare("SELECT payload, fetched_at FROM titles WHERE id = 'movie-1010'").get();
      return { payload: JSON.parse(String(found?.payload)) as Record<string, unknown>, fetched_at: Number(found?.fetched_at) };
    } finally {
      db.close();
    }
  };
  const before = row();
  assert.deepEqual([before.payload.shape, before.payload.plot], ["detail", "Plot 1010"]);

  f.t.clock.advance(FOUR_DAYS_MS);
  Object.assign(tmdb.state, { rating: 9.1, poster: "/new.jpg" });
  await f.renew(); // the clock moved past the session's lifetime
  assert.equal((await f.api("POST", "/api/jobs/1/run")).status, 202);
  await f.finished();
  const after = row();
  assert.equal(after.payload.shape, "detail");
  assert.equal(after.payload.plot, "Plot 1010", "the detail's own fields stand");
  assert.equal(after.fetched_at, before.fetched_at, "its age stays");
  assert.deepEqual([after.payload.rating, after.payload.posterUrl], [9.1, "https://image.tmdb.org/t/p/w500/new.jpg"]);
});
