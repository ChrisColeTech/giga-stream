import assert from "node:assert/strict";
import test from "node:test";
import { executeCatalogWorker } from "../src/services/catalog-worker-execution.js";
import { createJobProgress } from "../src/services/job-progress.js";
import type { CatalogJob, JobRecord } from "../src/store/job-repository.js";
import type { CatalogWorkerRuntime } from "../src/types/catalog-worker.js";

const job: CatalogJob = {
  id: 6, type: "catalog", name: "Library fill", enabled: true, schedule: "24h",
  config: { scope: "discover" }, createdAt: 1,
};
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

function harness(found: JobRecord | undefined = job) {
  let resolve!: (ended: JobRecord | undefined) => void;
  let reject!: (error: Error) => void;
  const settled = new Promise<JobRecord | undefined>((yes, no) => { resolve = yes; reject = no; });
  const calls: string[] = [];
  const logs: Array<Record<string, string | number>> = [];
  const signal = new AbortController();
  const progress = createJobProgress({ now: () => 1 });
  const runtime: CatalogWorkerRuntime = {
    jobs: { find: async () => found },
    progress,
    runner: {
      run: async (_job, actor, triggered) => {
        assert.deepEqual(actor, {});
        assert.equal(triggered, "system");
        calls.push("start");
        progress.start(6, "movies")({ phase: "movies", done: 2, total: 3 });
      },
      wait: () => { calls.push("wait"); return settled; },
      abort: () => { calls.push("abort"); return true; },
      shutdown: async () => { calls.push("shutdown"); },
    },
    close: () => { calls.push("close"); },
  };
  const run = (over: Partial<Parameters<typeof executeCatalogWorker>[0]> = {}) => executeCatalogWorker({
    jobId: 6, tmdbToken: "secret-test-token", signal: signal.signal,
    open: async () => { calls.push("open"); return runtime; }, log: (event) => logs.push(event), ...over,
  });
  return { run, signal, calls, logs, runtime, resolve, reject };
}

test("waits beyond acceptance, reports safe progress and closes only after persisted success", async () => {
  const h = harness();
  let finished = false;
  const pending = h.run().then((code) => { finished = true; return code; });
  await flush();
  assert.equal(finished, false);
  assert.deepEqual(h.calls, ["open", "start", "wait"]);
  const counts = { titles: 3, stale: 0, detailed: 2, seasons: 1, enriched: 0, airing: 0 };
  h.resolve({ ...job, lastRunAt: 2, lastResult: "ok", lastCounts: counts });
  assert.equal(await pending, 0);
  assert.deepEqual(h.calls, ["open", "start", "wait", "shutdown", "close"]);
  assert.ok(h.logs.some((event) => event.event === "progress" && event.done === 2));
  assert.deepEqual(h.logs.at(-1), { event: "finished", jobId: 6, outcome: "ok", ...counts });
  assert.ok(!JSON.stringify(h.logs).includes("secret-test-token"));
});

test("invalid configuration fails before opening resources or running work", async () => {
  for (const jobId of [undefined, 0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    const h = harness();
    assert.equal(await h.run({ jobId }), 1);
    assert.deepEqual(h.calls, []);
  }
  const h = harness();
  assert.equal(await h.run({ tmdbToken: "" }), 1);
  assert.deepEqual(h.calls, []);
});

test("missing and noncatalog IDs close without execution", async () => {
  const playlist: JobRecord = { id: 6, type: "playlist", playlistId: 1,
    enabled: true, schedule: "24h", createdAt: 1 };
  for (const found of [undefined, playlist]) {
    const h = harness();
    h.runtime.jobs.find = async () => found;
    assert.equal(await h.run(), 1);
    assert.deepEqual(h.calls, ["open", "shutdown", "close"]);
  }
});

test("failed, stopped, absent and unpersisted terminal records are nonzero", async () => {
  for (const result of ["failed", "stopped", "ok", undefined] as const) {
    const h = harness();
    const pending = h.run();
    h.resolve(result === undefined ? undefined : { ...job, lastResult: result,
      ...(result !== "ok" && { lastRunAt: 2 }) });
    assert.equal(await pending, 1);
    assert.equal(h.calls.at(-1), "close");
  }
});

test("a persistence rejection cannot reuse an old successful record or leak the exception", async () => {
  const h = harness({ ...job, lastResult: "ok", lastRunAt: 1 });
  const pending = h.run();
  await flush();
  h.reject(new Error("secret database URL"));
  assert.equal(await pending, 1);
  assert.ok(!JSON.stringify(h.logs).includes("secret database URL"));
  assert.equal(h.calls.at(-1), "close");
});

test("SIGTERM/SIGINT cancellation waits for settlement, even if the terminal result races to ok", async () => {
  for (const result of ["stopped", "ok"] as const) {
    const h = harness();
    const pending = h.run();
    await flush();
    h.signal.abort();
    await flush();
    assert.ok(h.calls.includes("abort"));
    assert.ok(!h.calls.includes("close"));
    h.resolve({ ...job, lastRunAt: 2, lastResult: result });
    assert.equal(await pending, 1);
    assert.equal(h.calls.at(-1), "close");
  }
});

test("cancellation during acceptance is reapplied after the runner creates its flight", async () => {
  const h = harness();
  h.runtime.runner.run = async () => { h.signal.abort(); h.calls.push("accepted"); };
  const pending = h.run();
  await flush();
  assert.deepEqual(h.calls, ["open", "abort", "accepted", "abort", "wait"]);
  h.resolve({ ...job, lastResult: "stopped", lastRunAt: 2 });
  assert.equal(await pending, 1);
});

test("pre-aborted execution opens nothing; cleanup failure makes success nonzero", async () => {
  const h = harness();
  h.signal.abort();
  assert.equal(await h.run(), 1);
  assert.deepEqual(h.calls, []);
  const broken = harness();
  broken.runtime.close = () => { throw new Error("close"); };
  const pending = broken.run();
  broken.resolve({ ...job, lastResult: "ok", lastRunAt: 2 });
  assert.equal(await pending, 1);
});

test("startup and acceptance failures exit nonzero; opened resources are closed", async () => {
  const startup = harness();
  assert.equal(await startup.run({ open: async () => { throw new Error("private connection string"); } }), 1);
  assert.ok(!JSON.stringify(startup.logs).includes("private connection string"));
  const refused = harness();
  refused.runtime.runner.run = async () => { throw new Error("busy"); };
  assert.equal(await refused.run(), 1);
  assert.deepEqual(refused.calls, ["open", "shutdown", "close"]);
});

test("a signal during resource startup closes the runtime without launching the job", async () => {
  const h = harness();
  assert.equal(await h.run({ open: async () => { h.signal.abort(); return h.runtime; } }), 1);
  assert.ok(!h.calls.includes("start"));
  assert.equal(h.calls.at(-1), "close");
});
