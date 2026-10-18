// Sync jobs (docs/26 section 3.11, docs/43 section 3.1): catalog jobs are made by hand; a playlist's job is part of its
// playlist - never created or deleted here, only enabled or rescheduled (at least 15 minutes). Typed results only.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { itemsOf } from "./live-channel-kit.js";
import { M3U, setupPlaylists, uploadFile, until } from "./playlist-kit.js";
import { makeApp, pick, send, signIn } from "./test-app.js";
import { mutableTmdb } from "./title-edit-kit.js";

const catalogBody = (over: Record<string, unknown> = {}) => ({ type: "catalog", name: "x", config: { scope: "trending", kind: "movie" }, ...over });

test("every route needs a signed-in admin: 401 without a token", async () => {
  const { t } = await setupPlaylists();
  for (const [method, url, body] of [
    ["GET", "/api/jobs", undefined], ["POST", "/api/jobs", catalogBody()], ["GET", "/api/jobs/1", undefined],
    ["PATCH", "/api/jobs/1", { enabled: false }], ["DELETE", "/api/jobs/1", undefined], ["POST", "/api/jobs/1/run", {}],
  ] as const) {
    for (const token of [undefined, "not-a-token"]) {
      const answer = await send(t.app, method, url, body, token);
      assert.deepEqual([answer.status, pick(answer.body, "error.code")], [401, "auth.unauthorized"], `${method} ${url}`);
    }
  }
});

test("the environment seeds the catalog job on the first start only; a playlist is never seeded", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-jobs-"));
  try {
    const first = await makeApp({ dataDir, config: { TMDB_SYNC_SCHEDULE: "12h" } });
    const token = (await signIn(first.app)).access;
    const jobs = itemsOf((await send(first.app, "GET", "/api/jobs", undefined, token)).body);
    assert.deepEqual(jobs.map((j) => [j.type, j.name, j.enabled, j.schedule, j.config]), [
      ["catalog", "Library fill", true, "12h", { scope: "discover", pages: 500 }],
      ["catalog", "Library update", true, "24h", { scope: "recent", pages: 1 }],
    ]);
    assert.equal(itemsOf((await send(first.app, "GET", "/api/playlists", undefined, token)).body).length, 0);
    for (const job of jobs) await send(first.app, "DELETE", `/api/jobs/${job.id}`, undefined, token);
    await first.dispose();
    const second = await makeApp({ dataDir, config: { TMDB_SYNC_SCHEDULE: "2h" } });
    const again = (await signIn(second.app)).access;
    assert.equal(itemsOf((await send(second.app, "GET", "/api/jobs", undefined, again)).body).length, 0, "not seeded again");
    await second.dispose();
  } finally {
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // Windows can hold the SQLite file open briefly after dispose; the temp dir is cleaned up on reboot.
    }
  }
});

test("a catalog job is created, read, changed and deleted; every refusal names its field", async () => {
  const { api } = await setupPlaylists();
  const made = await api("POST", "/api/jobs", catalogBody({ name: "Series", schedule: "60m", enabled: false, config: { scope: "popular", kind: "tv" } }));
  assert.deepEqual(
    ["status", "data.type", "data.enabled", "data.schedule", "data.config", "data.running"].map((f) => (f === "status" ? made.status : pick(made.body, f))),
    [201, "catalog", false, "1h", { scope: "popular", kind: "tv", pages: 5 }, false],
  );
  const id = Number(pick(made.body, "data.id"));
  const refusal = async (body: unknown) => {
    const answer = await api("POST", "/api/jobs", body);
    return [answer.status, pick(answer.body, "error.code"), pick(answer.body, "error.details.field")];
  };
  const bad = (field: string) => [422, "job.invalid", field];
  assert.deepEqual(await refusal(catalogBody({ type: "playlist" })), bad("type"), "a playlist job is made by an import");
  assert.deepEqual(await refusal({ type: "playlist", name: "x", config: { playlistId: 1 } }), bad("type"));
  assert.deepEqual(await refusal(catalogBody({ type: "radio" })), bad("type"));
  assert.deepEqual(await refusal(catalogBody({ schedule: "soon" })), bad("schedule"));
  assert.deepEqual(await refusal(catalogBody({ config: { scope: "newest", kind: "movie" } })), bad("config.scope"));
  assert.deepEqual(await refusal(catalogBody({ config: { scope: "trending", kind: "movie", pages: 501 } })), bad("config.pages"));
  assert.deepEqual(await refusal(catalogBody({ colour: "red" })), bad("colour"));
  const changed = await api("PATCH", `/api/jobs/${id}`, { name: "Renamed", enabled: true, schedule: "30m", config: { pages: 2 } });
  assert.deepEqual(["name", "enabled", "schedule", "config"].map((f) => pick(changed.body, `data.${f}`)), ["Renamed", true, "30m", { scope: "popular", kind: "tv", pages: 2 }]);
  assert.equal(pick((await api("PATCH", `/api/jobs/${id}`, { config: { scope: "popular", playlistId: 3 } })).body, "error.details.field"), "config.playlistId");
  assert.equal((await api("PATCH", `/api/jobs/${id}`, { type: "playlist" })).status, 422, "the type never changes");
  assert.equal((await api("PATCH", "/api/jobs/99", { name: "x" })).status, 404);
  assert.deepEqual((await api("DELETE", `/api/jobs/${id}`)).body, { ok: true, data: { id } });
  assert.deepEqual([(await api("GET", `/api/jobs/${id}`)).status], [404]);
});

test("a playlist's job is part of its playlist: named after it, rescheduled and toggled only, never deleted, 15 minutes at least", async () => {
  const { t, token, api } = await setupPlaylists();
  await uploadFile(t, token, "mine.m3u", M3U);
  const read = async () => pick((await api("GET", "/api/jobs")).body, "data.items") as Array<Record<string, unknown>>;
  const job = (await read()).find((j) => j.type === "playlist") ?? {};
  assert.deepEqual([job.name, job.config, job.playlistId, job.playlistName, job.schedule, job.running], ["Sync mine.m3u", { playlistId: 1 }, 1, "mine.m3u", "24h", false]);
  await api("PATCH", "/api/playlists/1", { name: "Renamed" });
  assert.equal((await read()).find((j) => j.type === "playlist")?.name, "Sync Renamed", "a rename can never leave the job's name stale");
  const id = Number(job.id);
  const patch = async (body: unknown) => {
    const answer = await api("PATCH", `/api/jobs/${id}`, body);
    return [answer.status, pick(answer.body, "error.code"), pick(answer.body, "error.details.field")];
  };
  for (const schedule of ["10m", "14m", "500ms", "45s"]) assert.deepEqual(await patch({ schedule }), [422, "job.invalid", "schedule"], schedule);
  assert.deepEqual(await patch({ schedule: "15m", enabled: false }), [200, undefined, undefined]);
  assert.deepEqual(await patch({ schedule: "off" }), [200, undefined, undefined]);
  assert.deepEqual(await patch({ schedule: "6h", enabled: true }), [200, undefined, undefined]);
  assert.deepEqual(await patch({ name: "mine" }), [422, "job.invalid", "name"]);
  assert.deepEqual(await patch({ config: { pages: 3 } }), [422, "job.invalid", "config"]);
  const refusedDelete = await api("DELETE", `/api/jobs/${id}`);
  assert.deepEqual([refusedDelete.status, pick(refusedDelete.body, "error.code")], [422, "job.invalid"]);
  assert.equal((await read()).length, 3, "the job is still there (the fill, the update and the playlist's)");
});

test("a DISABLED catalog job runs by hand (its switch gates only the schedule) and keeps a typed result: the titles pulled and how many are stale", async () => {
  const tmdb = await mutableTmdb();
  const t = await makeApp({ config: { TMDB_READ_TOKEN: "test-token", TMDB_BASE: tmdb.base } });
  const token = (await signIn(t.app)).access;
  const id = Number(itemsOf((await send(t.app, "GET", "/api/jobs", undefined, token)).body)[0]?.id);
  await send(t.app, "PATCH", `/api/jobs/${id}`, { enabled: false, config: { pages: 1 } }, token);
  const started = await send(t.app, "POST", `/api/jobs/${id}/run`, {}, token);
  assert.deepEqual([started.status, pick(started.body, "data.running")], [202, true]);
  const read = async () => pick((await send(t.app, "GET", `/api/jobs/${id}`, undefined, token)).body, "data") as Record<string, unknown>;
  await until(async () => (await read()).lastResult !== undefined, "the catalog run");
  const done = await read();
  assert.deepEqual([done.lastResult, done.lastCounts, done.running, done.lastOutcome], ["ok", { titles: 2, detailed: 2, seasons: 0, enriched: 0, airing: 0, stale: 0 }, false, undefined]);
  assert.ok(tmdb.calls.includes("/discover/movie"));
});

test("a catalog run that fails keeps the error's code, never the exception's message", async () => {
  const t = await makeApp({ config: { TMDB_READ_TOKEN: "test-token", TMDB_BASE: "http://127.0.0.1:1" } });
  const token = (await signIn(t.app)).access;
  const id = Number(itemsOf((await send(t.app, "GET", "/api/jobs", undefined, token)).body)[0]?.id);
  await send(t.app, "PATCH", `/api/jobs/${id}`, { enabled: true }, token);
  await send(t.app, "POST", `/api/jobs/${id}/run`, {}, token);
  const read = async () => pick((await send(t.app, "GET", `/api/jobs/${id}`, undefined, token)).body, "data") as Record<string, unknown>;
  await until(async () => (await read()).lastResult !== undefined, "the failed run");
  const done = await read();
  assert.equal(done.lastResult, "failed");
  assert.deepEqual(done.lastCounts, { code: "tmdb.unavailable" });
});
