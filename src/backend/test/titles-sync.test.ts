import test from "node:test";
import assert from "node:assert/strict";

import { FIRST_RUN_GRACE_MS } from "../src/constants/limits.js";
import { makeApp, pick, send, signIn } from "./test-app.js";
import { omdbOn, settled, stubOmdb, stubTmdb, tmdbOn } from "./title-stubs.js";

test("sync is admin-only, single-flight, audited, and reports its outcome in the status", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({ config: tmdbOn(tmdb) });
  const access = (await signIn(t.app)).access;

  const denied = await send(t.app, "POST", "/api/titles/sync");
  assert.equal(denied.status, 401);

  // It starts the Library fill job (docs/44) even while that job is disabled: its switch gates only the schedule.
  const job = await send(t.app, "PATCH", "/api/jobs/1", { enabled: false, config: { pages: 2 } }, access);
  assert.equal(pick(job.body, "data.enabled"), false);
  const started = await send(t.app, "POST", "/api/titles/sync", undefined, access);
  assert.deepEqual([started.status, pick(started.body, "data.running")], [202, true]);

  const busy = await send(t.app, "POST", "/api/titles/sync", undefined, access);
  assert.equal(busy.status, 409);
  assert.equal(pick(busy.body, "error.code"), "sync.busy");

  const bad = await send(t.app, "POST", "/api/titles/sync", { scope: "titles" }, access);
  assert.equal(pick(bad.body, "error.code"), "sync.invalid");

  await settled(t);
  const status = await send(t.app, "GET", "/api/titles/sync", undefined, access);
  assert.equal(pick(status.body, "data.running"), false);
  assert.equal(pick(status.body, "data.lastOutcome"), "ok");
  assert.ok(Number(pick(status.body, "data.titles")) >= 1);
  assert.equal(pick(status.body, "data.schedule"), "off");

  const audit = await send(t.app, "GET", "/api/audit?limit=10", undefined, access);
  const actions = (pick(audit.body, "data.items") as Array<Record<string, unknown>>).map((a) => a.action);
  assert.ok(actions.includes("sync.started"));
  assert.ok(actions.includes("sync.finished"));
  await t.dispose();
});

test("TMDB_SYNC_SCHEDULE arms the warm-up, audited as system, without touching the revision", async () => {
  const tmdb = await stubTmdb();
  const t = await makeApp({
    config: { ...tmdbOn(tmdb), TMDB_SYNC_SCHEDULE: "150ms" },
  });
  const access = (await signIn(t.app)).access;
  const healthBefore = await send(t.app, "GET", "/healthz");
  const revisionBefore = pick(healthBefore.body, "data.revision");

  // A job that never ran is due once the start grace has passed (docs/43 section 3.4); a change re-arms the timer.
  t.clock.advance(FIRST_RUN_GRACE_MS + 1);
  await send(t.app, "PATCH", "/api/jobs/1", { schedule: "150ms" }, access);

  // Wait until the scheduled warm-up has pulled at least one title into the store.
  for (let i = 0; i < 400; i++) {
    const status = await send(t.app, "GET", "/api/titles/sync", undefined, access);
    if (Number(pick(status.body, "data.titles")) >= 1) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  const status = await send(t.app, "GET", "/api/titles/sync", undefined, access);
  assert.equal(pick(status.body, "data.schedule"), "150ms");
  assert.ok(Number(pick(status.body, "data.titles")) >= 1);

  const healthAfter = await send(t.app, "GET", "/healthz");
  assert.equal(pick(healthAfter.body, "data.revision"), revisionBefore);

  const audit = await send(t.app, "GET", "/api/audit?limit=30", undefined, access);
  const system = (pick(audit.body, "data.items") as Array<Record<string, unknown>>).find(
    (a) => a.action === "sync.started",
  );
  assert.ok(system !== undefined);
  assert.equal(system!.actorUsername ?? null, null);

  await t.dispose();
});

test("the Library fill asks OMDb once per GAP title by IMDb id; reads add no call; the status reports the counter", async () => {
  const tmdb = await stubTmdb({ matrixWithout: ["overview"] }); // The Matrix and Game of Thrones both lack a plot
  const omdb = await stubOmdb();
  const t = await makeApp({ config: omdbOn(tmdb, omdb) });
  const access = (await signIn(t.app)).access;
  await send(t.app, "PATCH", "/api/jobs/1", { enabled: true, config: { pages: 1 } }, access);
  assert.equal((await send(t.app, "POST", "/api/titles/sync", undefined, access)).status, 202);
  await settled(t);

  const detail = await send(t.app, "GET", "/api/titles/movie-603");
  assert.deepEqual([pick(detail.body, "data.shape"), pick(detail.body, "data.imdbId")], ["detail", "tt0133093"]);
  assert.equal(pick(detail.body, "data.omdb.rated"), "R", "the sync's details phase attached OMDb's block");
  assert.match(String(pick(detail.body, "data.plot")), /^When a beautiful stranger/, "the empty plot is filled from OMDb");
  assert.equal(pick((await send(t.app, "GET", "/api/titles/tv-1399", undefined, access)).body, "data.omdb"), undefined, "OMDb missed this one");
  assert.deepEqual(omdb.calls.map((c) => c.split("|")[0]).sort(), ["tt0133093", "tt0944947"], "two calls in the sync, none in a read");
  const status = await send(t.app, "GET", "/api/titles/sync", undefined, access);
  assert.deepEqual(pick(status.body, "data.omdb"), { enabled: true, calls: 2, limit: 1000 });
  await t.dispose();
});
