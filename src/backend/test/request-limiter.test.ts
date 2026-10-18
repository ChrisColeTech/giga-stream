// The sync's one request limit (docs/43 section 3.4): 16 at a time across everything, 2 at a time to one host. Tasks wait on
// gates the test opens, so there is no clock and no sleeping.
import assert from "node:assert/strict";
import test from "node:test";

import { SYNC_CONCURRENCY, SYNC_PER_HOST_CONCURRENCY } from "../src/constants/limits.js";
import { createRequestLimiter } from "../src/services/request-limiter.js";

/** A task that counts itself in and out, and ends only when its gate opens. */
function gated() {
  const stats = { now: 0, peak: 0, perHost: new Map<string, number>(), peakHost: 0, done: 0 };
  const opens: Array<() => void> = [];
  const task = (host: string) => async (): Promise<string> => {
    stats.now += 1;
    stats.peak = Math.max(stats.peak, stats.now);
    const onHost = (stats.perHost.get(host) ?? 0) + 1;
    stats.perHost.set(host, onHost);
    stats.peakHost = Math.max(stats.peakHost, onHost);
    await new Promise<void>((open) => opens.push(open));
    stats.now -= 1;
    stats.perHost.set(host, (stats.perHost.get(host) ?? 1) - 1);
    stats.done += 1;
    return host;
  };
  /** Opens the gates of whatever is running now, then lets the freed slots start the next tasks. */
  const openAll = async (): Promise<void> => {
    for (const open of opens.splice(0)) open();
    await new Promise((resolve) => setImmediate(resolve));
  };
  return { stats, task, openAll };
}

test("the limits are the owner's: 16 at a time, 2 to one host", () => {
  assert.deepEqual([SYNC_CONCURRENCY, SYNC_PER_HOST_CONCURRENCY], [16, 2]);
});

test("at most 16 run at once across hosts, and every task finishes", async () => {
  const limiter = createRequestLimiter({ global: SYNC_CONCURRENCY, perHost: SYNC_PER_HOST_CONCURRENCY });
  const { stats, task, openAll } = gated();
  const all = Array.from({ length: 50 }, (_, i) => limiter.run(`host-${i}.example`, task(`host-${i}.example`)));
  assert.deepEqual([limiter.active(), limiter.waiting()], [16, 34], "16 started, the rest wait");
  while (stats.done < 50) await openAll();
  assert.equal((await Promise.all(all)).length, 50);
  assert.deepEqual([stats.peak, limiter.active(), limiter.waiting()], [16, 0, 0]);
});

test("at most 2 run to one host, and a full host does not hold back another", async () => {
  const limiter = createRequestLimiter({ global: SYNC_CONCURRENCY, perHost: SYNC_PER_HOST_CONCURRENCY });
  const { stats, task, openAll } = gated();
  const same = Array.from({ length: 10 }, () => limiter.run("one.example", task("one.example")));
  assert.deepEqual([limiter.active(), limiter.waiting()], [2, 8], "two to the host, eight wait though 14 slots are free");
  const other = limiter.run("two.example", task("two.example"));
  assert.equal(limiter.active(), 3, "another host starts past the full one");
  while (stats.done < 11) await openAll();
  await Promise.all([...same, other]);
  assert.equal(stats.peakHost, 2);
});

test("a task that throws frees its slot and rejects its caller only", async () => {
  const limiter = createRequestLimiter({ global: 1, perHost: 1 });
  const failing = limiter.run("a.example", async () => {
    throw new Error("boom");
  });
  const after = limiter.run("a.example", async () => "next");
  await assert.rejects(failing, /boom/);
  assert.equal(await after, "next");
  assert.equal(limiter.active(), 0);
});
