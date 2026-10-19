// The scheduler's rules (docs/43 section 3.4) on a fake store, runner and timer: a never-run job waits the start grace,
// a run is started and never awaited, a running job is not due, and a busy engine is retried. No app, no sleeping.
import assert from "node:assert/strict";
import test, { afterEach, beforeEach, mock } from "node:test";

import { FIRST_RUN_GRACE_MS } from "../src/constants/limits.js";
import { createSyncScheduler } from "../src/services/sync-scheduler.js";
import type { JobRecord } from "../src/store/job-repository.js";

const START = Date.UTC(2026, 9, 16, 12);
/** Lets the timer callback's awaited work finish before the test asserts (setTimeout is mocked; this is not). */
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
const MINUTE = 60_000;

const playlistJob = (id: number, schedule: string, lastRunAt?: number): JobRecord => ({
  id, type: "playlist", playlistId: id, enabled: true, schedule, createdAt: START, ...(lastRunAt !== undefined && { lastRunAt }),
});
const catalogJob = (id: number, schedule: string, lastRunAt?: number): JobRecord => ({
  id, type: "catalog", name: "Fill", config: { scope: "discover" }, enabled: true, schedule, createdAt: START,
  ...(lastRunAt !== undefined && { lastRunAt }),
});

function harness(jobs: JobRecord[], answer: "started" | "busy" | "skipped" = "started") {
  let at = START;
  const running = new Set<number>();
  const started: number[] = [];
  const store = {
    jobs: {
      list: () => Promise.resolve(jobs),
      find: (id: number) => Promise.resolve(jobs.find((j) => j.id === id)),
    },
  };
  const runner = {
    scheduledRefusal: (): Promise<undefined> => Promise.resolve(undefined),
    isRunning: (id: number) => running.has(id),
    runScheduled(job: JobRecord) {
      started.push(job.id);
      if (answer === "started") running.add(job.id);
      return Promise.resolve(answer);
    },
  };
  const scheduler = createSyncScheduler({ store, runner, now: () => at, tmdbConfigured: true });
  return { scheduler, started, running, tick: (ms: number) => { at += ms; mock.timers.tick(ms); } };
}

beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
afterEach(() => mock.timers.reset());

test("a job that never ran is due at the start plus the grace, never during boot", async () => {
  const { scheduler, started, tick } = harness([playlistJob(1, "24h")]);
  await scheduler.arm();
  tick(FIRST_RUN_GRACE_MS - 1); await flush();
  assert.deepEqual(started, []);
  tick(1); await flush();
  assert.deepEqual(started, [1]);
  scheduler.stop();
});

test("a job that ran is due one interval after its last run, and never before the grace", async () => {
  const { scheduler, started, tick } = harness([playlistJob(1, "15m", START - 5 * MINUTE)]);
  await scheduler.arm();
  tick(10 * MINUTE - 1); await flush();
  assert.deepEqual(started, []);
  tick(1); await flush();
  assert.deepEqual(started, [1]);
  const early = harness([playlistJob(2, "15m", START - 15 * MINUTE + 6_000)]);
  await early.scheduler.arm();
  early.tick(FIRST_RUN_GRACE_MS - 1); await flush();
  assert.deepEqual(early.started, [], "due in six seconds, but not before the grace");
  early.tick(1); await flush();
  assert.deepEqual(early.started, [2], "the grace has passed");
  scheduler.stop();
  early.scheduler.stop();
});

test("a run is started, not awaited: the next job is armed at once and runs while the first is still going", async () => {
  const { scheduler, started, running, tick } = harness([playlistJob(1, "15m"), catalogJob(2, "1h", START - 60 * MINUTE + 40_000)]);
  await scheduler.arm();
  tick(FIRST_RUN_GRACE_MS); await flush();
  assert.deepEqual([started, running.has(1)], [[1], true], "the first started and is still running");
  assert.equal(scheduler.armed(), true, "the timer is armed again for the other job");
  tick(10_000); await flush();
  assert.deepEqual(started, [1, 2], "the second ran while the first was still going");
  scheduler.stop();
});

test("a running job is not due, so nothing is armed for it; its end arms the scheduler again", async () => {
  const { scheduler, running, tick } = harness([playlistJob(1, "15m")]);
  running.add(1);
  await scheduler.arm();
  assert.equal(scheduler.armed(), false);
  running.delete(1);
  await scheduler.arm();
  assert.equal(scheduler.armed(), true);
  tick(FIRST_RUN_GRACE_MS); await flush();
  scheduler.stop();
});

test("a busy engine is retried a second later; stop clears the timer", async () => {
  const { scheduler, started, tick } = harness([catalogJob(1, "30m")], "busy");
  await scheduler.arm();
  tick(FIRST_RUN_GRACE_MS); await flush();
  assert.deepEqual(started, [1]);
  tick(1_000); await flush();
  assert.deepEqual(started, [1, 1], "retried");
  scheduler.stop();
  assert.equal(scheduler.armed(), false);
  tick(60_000); await flush();
  assert.deepEqual(started, [1, 1]);
});

test("a stopped run keeps the stop time as its last run, so the scheduler waits a whole interval before running it again", async () => {
  const { scheduler, started, tick } = harness([{ ...playlistJob(1, "15m", START), lastResult: "stopped" }]);
  await scheduler.arm();
  tick(15 * MINUTE - 1); await flush();
  assert.deepEqual(started, [], "not restarted early");
  tick(1); await flush();
  assert.deepEqual(started, [1], "due one interval after the stop");
  scheduler.stop();
});
