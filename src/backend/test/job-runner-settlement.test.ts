import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/constants/errors.js";
import { EXTERNAL_EXECUTION_REASON } from "../src/constants/sync-execution.js";
import { CURSOR_OVERLAP_MS } from "../src/constants/limits.js";
import { createJobRunner } from "../src/services/job-runner.js";
import { createJobProgress } from "../src/services/job-progress.js";
import type { SyncResult } from "../src/services/title-sync.js";
import type { CatalogJob } from "../src/store/job-repository.js";

const NOW = 10_000_000;
const job: CatalogJob = { id: 7, name: "Update", type: "catalog", enabled: true, schedule: "24h",
  config: { scope: "recent" }, createdAt: 1, cursorAt: 20, lastResult: "ok", lastRunAt: 1 };
const done = (result: SyncResult["result"]): SyncResult =>
  ({ result, titles: 3, detailed: 2, enriched: 1, seasons: 1, airing: 1 });
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

function harness(disabled?: string) {
  let finish!: (result: SyncResult) => void;
  const body = new Promise<SyncResult>((resolve) => { finish = resolve; });
  let commit!: () => void;
  const writeGate = new Promise<void>((resolve) => { commit = resolve; });
  let saved = job;
  let signal: AbortSignal | undefined;
  let calls = 0;
  let rearmed = 0;
  let failWrite = false;
  const runner = createJobRunner({
    store: {
      jobs: {
        find: async () => saved,
        recordRun: async (_id, at, result, counts, cursorAt) => {
          await writeGate;
          if (failWrite) throw new Error("private database failure");
          saved = { ...saved, lastRunAt: at, lastResult: result, lastCounts: counts,
            ...(cursorAt !== undefined && { cursorAt }) };
        },
      },
      playlists: { find: async () => undefined },
    },
    audit: { record: async () => undefined }, now: () => NOW,
    titles: {
      runNow: async (request, actor, triggered, options) => {
        calls++;
        assert.deepEqual(request, { scope: "recent", since: 20 });
        assert.deepEqual(actor, {});
        assert.equal(triggered, "system");
        signal = options?.signal;
        return body;
      },
      status: async () => ({ running: false, titles: 3, stale: 1, schedule: "off",
        omdb: { enabled: false, calls: 0, limit: 1000 } }),
      isSyncRunning: () => false,
    },
    playlistJob: async () => { assert.fail("no playlist execution"); },
    progress: createJobProgress({ now: () => NOW }), onSettled: () => { rearmed++; },
    executionDisabledReason: disabled,
  });
  return { runner, finish, commit, saved: () => saved, calls: () => calls, rearmed: () => rearmed,
    aborted: () => signal?.aborted, failWrite: () => { failWrite = true; } };
}

test("wait includes final persistence, returns counts and advances only the successful recent cursor", async () => {
  const h = harness();
  await h.runner.run(job, {}, "system");
  let settled = false;
  const waiting = h.runner.wait(7).then((value) => { settled = true; return value; });
  h.finish(done("ok"));
  await flush();
  assert.equal(settled, false);
  assert.equal(h.runner.isRunning(7), true);
  assert.equal(h.saved().lastRunAt, 1);
  h.commit();
  const ended = await waiting;
  assert.equal(ended?.lastResult, "ok");
  assert.equal(ended?.cursorAt, NOW - CURSOR_OVERLAP_MS);
  assert.deepEqual(ended?.lastCounts, { titles: 3, detailed: 2, seasons: 1, enriched: 1, airing: 1, stale: 1 });
  assert.equal(h.runner.isRunning(7), false);
  assert.equal(h.rearmed(), 1);
  assert.deepEqual(await h.runner.wait(7), ended, "a fast-completed run remains awaitable");
});

test("stop and failure retain the cursor, and shutdown waits for writes instead of timing out", async () => {
  for (const result of ["stopped", "failed"] as const) {
    const h = harness();
    await h.runner.run(job, {}, "system");
    let closed = false;
    const shutdown = h.runner.shutdown().then(() => { closed = true; });
    assert.equal(h.aborted(), true);
    h.finish(done(result));
    await flush();
    assert.equal(closed, false);
    h.commit();
    await shutdown;
    assert.equal((await h.runner.wait(7))?.lastResult, result);
    assert.equal(h.saved().cursorAt, 20);
  }
});

test("a persistence failure rejects wait rather than reporting the previous successful run", async () => {
  const h = harness();
  h.failWrite();
  await h.runner.run(job, {}, "system");
  const waiting = assert.rejects(h.runner.wait(7), /private database failure/);
  h.finish(done("ok"));
  h.commit();
  await waiting;
  assert.equal(h.saved().lastRunAt, 1);
  await h.runner.shutdown();
});

test("external runner refuses every manual job and skips scheduled jobs without entering a body", async () => {
  const h = harness(EXTERNAL_EXECUTION_REASON);
  const playlist = { id: 9, type: "playlist", playlistId: 1, enabled: true, schedule: "24h", createdAt: 1 } as const;
  for (const record of [job, playlist]) {
    assert.equal(await h.runner.refusal(record), EXTERNAL_EXECUTION_REASON);
    await assert.rejects(h.runner.run(record, {}), (error: unknown) =>
      error instanceof AppError && error.code === "job.disabled" && error.message === EXTERNAL_EXECUTION_REASON);
    assert.equal(await h.runner.runScheduled(record), "skipped");
    assert.equal(h.runner.isRunning(record.id), false);
  }
  assert.equal(h.calls(), 0);
  assert.equal(h.rearmed(), 0);
});
