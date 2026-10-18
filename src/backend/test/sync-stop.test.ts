// Stop and resume (docs/43 section 3.4a): Stop cancels the run and keeps what was written; the same job run again resumes
// (the order puts the unchecked first, the 7-day window skips the cached logos). Idle 409, catalog 422, shutdown aborts.
import assert from "node:assert/strict";
import test from "node:test";

import { until } from "./playlist-kit.js";
import { MANIFEST, LOGO, PNG, STREAM, fakeNet, image, m3uEntry, setupSync, type Sync } from "./sync-kit.js";
import { pick, send } from "./test-app.js";

const verdicts = async (s: Sync): Promise<Record<string, unknown>> =>
  Object.fromEntries((await s.channels()).map((c) => [String(c.name), c.status ?? "unchecked"]));

async function threeChannels() {
  const net = fakeNet();
  net.set(LOGO("a"), image(PNG));
  for (const n of ["a", "b", "c"]) net.set(STREAM(`${n}.example`, n), MANIFEST);
  const s = await setupSync(net, ["a", "b", "c"].map((n) => m3uEntry(n, STREAM(`${n}.example`, n), n === "a" ? LOGO("a") : undefined)));
  return { net, s, gate: net.hold(STREAM("c.example", "c")) };
}

test("Stop mid-check ends the run stopped with the earlier verdicts kept; running it again resumes with the rest first", async () => {
  const { net, s, gate } = await threeChannels();
  const id = await s.id();
  assert.equal((await s.api("POST", `/api/jobs/${id}/run`)).status, 202);
  await gate.started;
  s.t.clock.advance(5_000);
  const stopped = await s.api("POST", `/api/jobs/${id}/stop`);
  assert.deepEqual([stopped.status, pick(stopped.body, "data.running")], [202, true], "answered at once, running until the next check");
  await until(async () => (await s.job()).running === false, "the run to end");
  const job = await s.job();
  assert.deepEqual([job.lastResult, pick(job, "lastCounts.stopped"), job.lastRunAt], ["stopped", true, s.t.clock.now()]);
  assert.deepEqual([pick(job, "lastCounts.live"), pick(job, "lastCounts.unchecked"), pick(job, "lastCounts.logosCached")], [2, 1, 1]);
  assert.deepEqual(await verdicts(s), { a: "live", b: "live", c: "unchecked" }, "the verdicts written before the stop are kept");
  const entry = (pick((await s.api("GET", "/api/audit?limit=20")).body, "data.items") as Array<Record<string, unknown>>)
    .find((e) => e.action === "job.stopped");
  assert.equal(entry?.subject, String(id));
  assert.ok(net.aborts() >= 1, "the held request was aborted, not waited for");

  gate.release();
  const seen = net.log.length;
  const resumed = await s.run();
  assert.deepEqual([resumed.lastResult, pick(resumed, "lastCounts.stopped")], ["ok", undefined]);
  assert.deepEqual(await verdicts(s), { a: "live", b: "live", c: "live" });
  const again = net.log.slice(seen);
  assert.equal(again.find((url) => url.endsWith(".m3u8")), STREAM("c.example", "c"), "the unchecked channel goes first");
  assert.equal(again.filter((url) => url.startsWith("https://img.example/")).length, 0, "no cached logo is downloaded again");
});

test("a stopped job is not restarted by the schedule: its last run is the stop time", async () => {
  const { s, gate } = await threeChannels();
  const id = await s.id();
  await s.api("PATCH", `/api/jobs/${id}`, { schedule: "15m" });
  await s.api("POST", `/api/jobs/${id}/run`);
  await gate.started;
  s.t.clock.advance(60_000);
  await s.api("POST", `/api/jobs/${id}/stop`);
  await until(async () => (await s.job()).running === false, "the run to end");
  const job = await s.job();
  assert.equal(job.lastRunAt, s.t.clock.now(), "due one interval after the stop, not at once (scheduler-unit.test.ts)");
  assert.equal(job.lastResult, "stopped");
});

test("Stop needs a session, an existing job that is running, and a playlist job", async () => {
  const net = fakeNet();
  const s = await setupSync(net, [m3uEntry("a", STREAM("a.example", "a"))]);
  const id = await s.id();
  assert.equal((await send(s.t.app, "POST", `/api/jobs/${id}/stop`)).status, 401);
  const idle = await s.api("POST", `/api/jobs/${id}/stop`);
  assert.deepEqual([idle.status, pick(idle.body, "error.code")], [409, "job.not_running"]);
  const missing = await s.api("POST", "/api/jobs/999/stop");
  assert.deepEqual([missing.status, pick(missing.body, "error.code")], [404, "job.not_found"]);
  const made = await s.api("POST", "/api/jobs", { type: "catalog", name: "Fill", config: { scope: "trending", kind: "movie" } });
  const catalog = await s.api("POST", `/api/jobs/${pick(made.body, "data.id")}/stop`);
  assert.deepEqual([catalog.status, pick(catalog.body, "error.code")], [422, "job.invalid"]);
});

test("shutdown aborts a run in flight and waits for it to settle before the store closes", async () => {
  const { net, s, gate } = await threeChannels();
  await s.api("POST", `/api/jobs/${await s.id()}/run`);
  await gate.started;
  await s.t.app.close();
  assert.ok(net.aborts() >= 1, "the held check was aborted by the shutdown");
});
