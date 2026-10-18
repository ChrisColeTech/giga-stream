// A playlist job reports real progress (docs/44 section 3.1): `reading`, `logos` (the distinct logo addresses to try) and
// `checking` (the distinct stream addresses), read from the job while it runs and gone when it ends.
import assert from "node:assert/strict";
import test from "node:test";

import { until } from "./playlist-kit.js";
import { LOGO, MANIFEST, PNG, STREAM, fakeNet, image, m3uEntry, setupSync } from "./sync-kit.js";
import { pick } from "./test-app.js";

test("a playlist job shows its logo and stream-check progress while it runs, and none once it ended", async () => {
  const net = fakeNet();
  net.set(LOGO("a"), image(PNG));
  for (const n of ["a", "b", "c"]) net.set(STREAM(`${n}.example`, n), MANIFEST);
  const logoGate = net.hold(LOGO("a"));
  const s = await setupSync(net, ["a", "b", "c"].map((n) => m3uEntry(n, STREAM(`${n}.example`, n), n === "a" ? LOGO("a") : undefined)));
  const id = await s.id();
  const progress = async (): Promise<unknown> => pick((await s.api("GET", `/api/jobs/${id}`)).body, "data.progress");
  assert.equal(await progress(), undefined, "idle: no progress");

  await s.api("POST", `/api/jobs/${id}/run`);
  await logoGate.started;
  assert.deepEqual(await progress(), { jobId: id, phase: "logos", done: 0, total: 1 }, "one distinct logo address to try");
  logoGate.release();

  const checkGate = net.hold(STREAM("c.example", "c"));
  await checkGate.started;
  await until(async () => pick(await progress(), "done") === 2, "two of three streams checked");
  assert.deepEqual(await progress(), { jobId: id, phase: "checking", done: 2, total: 3 });
  const listed = pick((await s.api("GET", "/api/jobs")).body, "data.items") as Array<Record<string, unknown>>;
  assert.deepEqual(listed.find((j) => j.id === id)?.progress, { jobId: id, phase: "checking", done: 2, total: 3 });

  checkGate.release();
  await until(async () => (await s.job()).running === false, "the run to end");
  const job = await s.job();
  assert.deepEqual([job.lastResult, job.progress], ["ok", undefined]);
});
