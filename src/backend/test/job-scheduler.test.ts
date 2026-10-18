// The backend's one timer in the running app (docs/26 section 3.11, docs/43 section 3.4): armed for the earliest due
// enabled job and re-armed at once on any change. The app's clock is moved by hand, so a due time is exact; the rules
// of the timer itself are in scheduler-unit.test.ts. Nothing touches the network.
import assert from "node:assert/strict";
import test from "node:test";

import { FIRST_RUN_GRACE_MS } from "../src/constants/limits.js";
import { ONE, setupPlaylists, until } from "./playlist-kit.js";
import { makeApp, pick, send, signIn } from "./test-app.js";
import { mutableTmdb } from "./title-edit-kit.js";

const nap = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("a playlist job runs by schedule once due, and every change to its switches re-arms at once", async () => {
  const s = await setupPlaylists();
  await s.importUrl(ONE);
  // The session token expires on the app's clock (15 minutes), so each long step signs in again.
  let token = s.token;
  const api = (method: "GET" | "PATCH", url: string, body?: unknown) => send(s.t.app, method, url, body, token);
  const later = async (ms: number): Promise<void> => {
    s.t.clock.advance(ms);
    token = (await signIn(s.t.app)).access;
  };
  const job = async () => (pick((await api("GET", "/api/jobs")).body, "data.items") as Array<Record<string, unknown>>).find((j) => j.type === "playlist") ?? {};
  const id = Number((await job()).id);
  const stays = async (what: string) => {
    await nap(250);
    const settled = s.feed.asked.length;
    await nap(250);
    assert.equal(s.feed.asked.length, settled, what);
  };
  assert.equal(s.feed.asked.length, 1, "only the import has fetched: nothing runs during boot");

  await later(FIRST_RUN_GRACE_MS + 1);
  await api("PATCH", `/api/jobs/${id}`, { schedule: "15m" });
  await until(async () => (await job()).lastResult === "ok", "the first scheduled run");
  assert.equal(s.feed.asked.length, 2);
  assert.equal((await job()).lastRunAt, s.t.clock.now());

  await later(16 * 60_000);
  await api("PATCH", `/api/jobs/${id}`, { enabled: false });
  await stays("a disabled job is not scheduled");
  const idle = s.feed.asked.length;
  await api("PATCH", `/api/jobs/${id}`, { enabled: true });
  await until(() => s.feed.asked.length > idle, "enabling re-arms");

  await later(16 * 60_000);
  await api("PATCH", `/api/jobs/${id}`, { schedule: "off" });
  await stays("an off schedule is not scheduled");
  const off = s.feed.asked.length;
  await api("PATCH", `/api/jobs/${id}`, { schedule: "15m" });
  await until(() => s.feed.asked.length > off, "a schedule re-arms");

  await later(16 * 60_000);
  await api("PATCH", "/api/playlists/1", { enabled: false });
  await stays("a disabled playlist is not scheduled");
  const paused = s.feed.asked.length;
  await api("PATCH", "/api/playlists/1", { enabled: true });
  await until(() => s.feed.asked.length > paused, "enabling the playlist re-arms");
});

test("a long run does not hold up the timer: another job runs while the first is still going", async () => {
  const s = await setupPlaylists();
  await s.importUrl(ONE);
  s.feed.set("https://other.example/all.m3u", "#EXTM3U");
  await s.importUrl("https://other.example/all.m3u");
  const jobs = async () => (pick((await s.api("GET", "/api/jobs")).body, "data.items") as Array<Record<string, unknown>>).filter((j) => j.type === "playlist");
  const gate = s.feed.hold(ONE);
  s.t.clock.advance(FIRST_RUN_GRACE_MS + 1);
  await s.api("PATCH", `/api/jobs/${(await jobs())[0]?.id}`, { schedule: "15m" });
  await gate.started;
  await until(async () => (await jobs())[1]?.lastResult === "ok", "the second job, while the first is held");
  assert.equal((await jobs())[0]?.running, true);
  gate.release();
  await until(async () => (await jobs())[0]?.lastResult === "ok", "the first job");
});

test("a catalog job is scheduled only when TMDB has a token; turning it off leaves manual syncs working", async () => {
  const tmdb = await mutableTmdb();
  const idle = await makeApp();
  const idleToken = (await signIn(idle.app)).access;
  idle.clock.advance(FIRST_RUN_GRACE_MS + 1);
  await send(idle.app, "PATCH", "/api/jobs/1", { enabled: true, schedule: "150ms" }, idleToken);
  await nap(450);
  assert.equal(pick((await send(idle.app, "GET", "/api/jobs/1", undefined, idleToken)).body, "data.lastRunAt"), undefined, "no token: never scheduled");

  const t = await makeApp({ config: { TMDB_READ_TOKEN: "test-token", TMDB_BASE: tmdb.base } });
  const token = (await signIn(t.app)).access;
  t.clock.advance(FIRST_RUN_GRACE_MS + 1);
  await send(t.app, "PATCH", "/api/jobs/1", { enabled: true, schedule: "150ms", config: { pages: 1 } }, token);
  await until(() => tmdb.calls.includes("/discover/movie") && tmdb.calls.includes("/discover/tv"), "the scheduled catalog run");
  assert.equal(pick((await send(t.app, "GET", "/api/titles/sync", undefined, token)).body, "data.schedule"), "150ms");
  await send(t.app, "PATCH", "/api/jobs/1", { enabled: false }, token);
  await nap(150);
  const stopped = tmdb.calls.length;
  await nap(450);
  assert.equal(tmdb.calls.length, stopped, "off clears the timer");
  assert.equal(pick((await send(t.app, "GET", "/api/titles/sync", undefined, token)).body, "data.schedule"), "off");
  tmdb.calls.length = 0;
  const started = await send(t.app, "POST", "/api/titles/sync", { scope: "trending", kind: "movie", pages: 1 }, token);
  assert.equal(started.status, 202);
  await until(() => tmdb.calls.includes("/trending/movie/week"), "the manual sync's TMDB call");
});

test("the sync status is the most recent run of its kind, whether a job or a manual call made it", async () => {
  const tmdb = await mutableTmdb();
  const t = await makeApp({ config: { TMDB_READ_TOKEN: "test-token", TMDB_BASE: tmdb.base } });
  const token = (await signIn(t.app)).access;
  const status = async () => (await send(t.app, "GET", "/api/titles/sync", undefined, token)).body;
  const settled = () => until(async () => pick(await status(), "data.running") === false, "the sync to end");
  await send(t.app, "PATCH", "/api/jobs/1", { enabled: true, config: { pages: 1 } }, token);
  await send(t.app, "POST", "/api/jobs/1/run", {}, token);
  await until(async () => pick(await status(), "data.lastOutcome") === "ok", "the job's run");
  await settled();
  assert.equal(pick((await send(t.app, "GET", "/api/jobs/1", undefined, token)).body, "data.lastResult"), "ok");

  // A manual run that fails (TMDB has no such title) replaces the job's "ok" in the status, and is reported running.
  const started = await send(t.app, "POST", "/api/titles/sync", { scope: "titles", ids: ["movie-999"] }, token);
  assert.deepEqual([started.status, pick(started.body, "data.running")], [202, true]);
  await settled();
  const after = await status();
  assert.notEqual(pick(after, "data.lastOutcome"), "ok", "the manual run's outcome, not the job's");
  assert.equal(typeof pick(after, "data.lastRunAt"), "number");
});
