import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { config } from "../src/config.js";
import { EXTERNAL_EXECUTION_REASON } from "../src/constants/sync-execution.js";
import { createServices } from "../src/services/service-registry.js";
import { serviceOptions } from "../src/services/service-options.js";
import { createStore } from "../src/store/store.js";
import { removeDir } from "./db-kit.js";
import { itemsOf, liveBody } from "./live-channel-kit.js";
import { M3U, uploadFile } from "./playlist-kit.js";
import { makeApp, pick, send, signIn } from "./test-app.js";

const localOnly = { skip: config.NODE_ENV === "production" || config.TURSO_DATABASE_URL !== "" };

test("external HTTP events finish with an empty snapshot without waiting for app shutdown",
  { ...localOnly, timeout: 5_000 }, async () => {
    const t = await makeApp({ config: { SYNC_EXECUTION_MODE: "external" } });
    const token = (await signIn(t.app)).access;
    const answer = await send(t.app, "GET", "/api/admin/jobs/events", undefined, token);
    assert.equal(answer.status, 200);
    assert.equal(answer.headers["content-type"], "text/event-stream");
    assert.equal(answer.headers["cache-control"], "no-store");
    assert.equal(answer.raw.toString(), 'event: snapshot\ndata: {"running":[]}\n\n');
    await t.dispose();
  });

test("external API refuses catalog, playlist and Library fill entrypoints with the same reason", localOnly, async () => {
  const t = await makeApp({ config: { SYNC_EXECUTION_MODE: "external", TMDB_SYNC_SCHEDULE: "1h" } });
  const token = (await signIn(t.app)).access;
  await uploadFile(t, token, "external.m3u", M3U);
  const jobs = itemsOf((await send(t.app, "GET", "/api/admin/jobs", undefined, token)).body);
  assert.ok(jobs.some((job) => job.type === "playlist"));
  assert.ok(jobs.some((job) => job.type === "catalog"));
  for (const job of jobs) {
    assert.equal(job.executionDisabledReason, EXTERNAL_EXECUTION_REASON);
    assert.equal(job.running, false);
    assert.equal(job.progress, undefined);
    const answer = await send(t.app, "POST", `/api/admin/jobs/${job.id}/run`, {}, token);
    assert.equal(answer.status, 422);
    assert.equal(pick(answer.body, "error.code"), "job.disabled");
    assert.equal(pick(answer.body, "error.message"), EXTERNAL_EXECUTION_REASON);
  }
  const catalog = jobs.find((job) => job.type === "catalog");
  assert.ok(catalog);
  const routed = await send(t.app, "POST", `/api/admin/catalog-jobs/${catalog.id}/run`, {}, token);
  assert.equal(pick(routed.body, "error.code"), "job.disabled");
  const fill = await send(t.app, "POST", "/api/admin/titles/sync", {}, token);
  assert.equal(fill.status, 422);
  assert.equal(pick(fill.body, "error.code"), "job.disabled");
  for (const job of jobs.filter((row) => row.type === "catalog")) {
    await send(t.app, "DELETE", `/api/admin/jobs/${job.id}`, undefined, token);
  }
  const absent = await send(t.app, "POST", "/api/admin/titles/sync", {}, token);
  assert.equal(pick(absent.body, "error.code"), "job.disabled", "external refusal precedes missing fill");
});

test("external registry stays passive after job writes and direct sync attempts", localOnly, async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-external-"));
  const store = await createStore(path.join(dir, "admin.db"));
  const settings = { ...config, DATA_DIR: dir, CACHE_DIR: path.join(dir, "cache"), TMDB_READ_TOKEN: "",
    SYNC_EXECUTION_MODE: "external" as const, TMDB_SYNC_SCHEDULE: "1h" };
  const services = await createServices(store, serviceOptions(settings, Date.now, () => undefined));
  try {
    const job = await services.jobs.create({ type: "catalog", name: "New fill", config: { scope: "discover" } }, {});
    await services.jobs.update(job.id, { enabled: true, schedule: "1h" }, {});
    await services.scheduler.arm();
    assert.equal(services.scheduler.armed(), false);
    assert.throws(() => services.titles.runNow({ scope: "discover" }, {}, "system"),
      { code: "job.disabled", message: EXTERNAL_EXECUTION_REASON });
    assert.equal(services.titles.isSyncRunning(), false);
    const record = await store.jobs.find(job.id);
    assert.ok(record);
    await assert.rejects(services.jobs.run(job.id, {}), { code: "job.disabled" });
    await assert.rejects(services.runner.run(record, {}), { code: "job.disabled" });
    await services.scheduler.arm();
    assert.equal(services.scheduler.armed(), false, "manual refusals cannot arm or hold the scheduler");
    assert.equal(services.events.count(), 0);
    assert.equal(await services.runner.runScheduled(record), "skipped");
    assert.equal((await services.jobs.get(job.id)).running, false);
    await services.jobs.remove(job.id, {});
    await services.scheduler.arm(0);
    assert.equal(services.scheduler.armed(), false);
  } finally {
    services.scheduler.stop();
    services.events.closeAll();
    await services.runner.shutdown();
    services.titles.close();
    await services.live.stop();
    store.close();
    removeDir(dir);
  }
});

test("external boot never starts saved live encoders, and writes cannot start them later", localOnly, async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-passive-live-"));
  try {
    const first = await makeApp({ dataDir: dir, config: { SYNC_EXECUTION_MODE: "inline" } });
    const token = (await signIn(first.app)).access;
    const made = await send(first.app, "POST", "/api/admin/channels", liveBody(), token);
    assert.equal(made.status, 201);
    await first.live.settled();
    assert.ok(first.tally.built > 0);
    await first.dispose();
    const passive = await makeApp({ dataDir: dir, seed: true, config: { SYNC_EXECUTION_MODE: "external" } });
    const auth = (await signIn(passive.app)).access;
    await passive.live.settled();
    assert.equal(passive.tally.built, 0);
    for (const action of ["rebuild"] as const) {
      const answer = await send(passive.app, "POST", `/api/admin/channels/home/${action}`, {}, auth);
      assert.equal(pick(answer.body, "error.code"), "job.disabled");
    }
    const changed = await send(passive.app, "PATCH", "/api/admin/channels/home", { enabled: true }, auth);
    assert.equal(pick(changed.body, "error.code"), "job.disabled");
    const created = await send(passive.app, "POST", "/api/admin/channels", liveBody({ id: "second" }), auth);
    assert.equal(pick(created.body, "error.code"), "job.disabled");
    assert.equal(passive.tally.built, 0);
    await passive.dispose();
  } finally { removeDir(dir); }
});
