// The backend's one timer (docs/26 section 3.11, `01` section 4.4): armed for the earliest due enabled job, re-armed
// at once on any change to a job's `enabled` or `schedule` or a playlist's `enabled`. The app's clock is frozen, so
// an interval is exactly the real wait; the intervals are short and the checks poll. Nothing touches the network.
import assert from "node:assert/strict";
import test from "node:test";

import { makeApp, pick, send, signIn } from "./test-app.js";
import { mutableTmdb } from "./title-edit-kit.js";

const ONE = "https://one.example/list.m3u8";
const TWO = "https://two.example/list.m3u8";
const M3U = '#EXTM3U\n#EXTINF:-1 group-title="News",ABC\nhttps://stream.example/abc.m3u8';

const nap = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(done: () => boolean | Promise<boolean>, what: string): Promise<void> {
  for (let i = 0; i < 300; i += 1) {
    if (await done()) return;
    await nap(15);
  }
  throw new Error(`timed out waiting for ${what}`);
}

async function setup() {
  const asked: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    if (String(input).includes("m3u8")) asked.push(String(input));
    return String(input).includes("m3u8") ? new Response(M3U) : new Response("missing", { status: 404 });
  };
  const t = await makeApp({ fetch: fetchImpl });
  const token = (await signIn(t.app)).access;
  const api = (method: "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => send(t.app, method, url, body, token);
  const stays = async (what: string) => {
    await nap(120);
    const settled = asked.length;
    await nap(380);
    assert.equal(asked.length, settled, what);
  };
  return { t, token, asked, api, stays };
}

test("a job's schedule arms the timer, and every change to it re-arms at once", async () => {
  const { asked, api, stays } = await setup();
  await api("POST", "/api/playlists", { address: ONE });
  const made = await api("POST", "/api/jobs", { type: "playlist", name: "One", schedule: "120ms", config: { playlistId: 1 } });
  const id = Number(pick(made.body, "data.id"));
  await until(() => asked.length >= 2, "scheduled runs");

  await api("PATCH", `/api/jobs/${id}`, { enabled: false });
  await stays("disabling the job clears the timer");
  const stopped = asked.length;
  await api("PATCH", `/api/jobs/${id}`, { enabled: true });
  await until(() => asked.length > stopped, "enabling re-arms");

  await api("PATCH", `/api/jobs/${id}`, { schedule: "off" });
  await stays("an off schedule clears the timer");
  await api("PATCH", `/api/jobs/${id}`, { schedule: "120ms" });
  await until(() => asked.length > stopped + 1, "a schedule re-arms");

  await api("PATCH", "/api/playlists/1", { enabled: false });
  await stays("a disabled playlist is skipped by every job");
  const idle = asked.length;
  await api("PATCH", "/api/playlists/1", { enabled: true });
  await until(() => asked.length > idle, "enabling the playlist re-arms");

  await api("DELETE", `/api/jobs/${id}`);
  await stays("deleting the job clears the timer");
});

test("one timer serves every job: two playlists' jobs each run, and a job that never ran is due at once", async () => {
  const { t, token, asked, api } = await setup();
  await api("POST", "/api/playlists", { address: ONE });
  await api("POST", "/api/playlists", { address: TWO });
  await api("POST", "/api/jobs", { type: "playlist", name: "One", schedule: "150ms", config: { playlistId: 1 } });
  await api("POST", "/api/jobs", { type: "playlist", name: "Two", schedule: "150ms", config: { playlistId: 2 } });
  await until(() => asked.includes(ONE) && asked.includes(TWO), "both jobs");
  const jobs = pick((await send(t.app, "GET", "/api/jobs", undefined, token)).body, "data.items") as Array<Record<string, unknown>>;
  const mine = jobs.filter((j) => j.type === "playlist");
  assert.deepEqual(mine.map((j) => j.lastOutcome), ["ok", "ok"]);
  assert.ok(mine.every((j) => typeof j.lastRunAt === "number"));
  const status = await send(t.app, "GET", "/api/playlist-sync", undefined, token);
  assert.equal(pick(status.body, "data.schedule"), "150ms", "the wrapper's schedule is the first enabled playlist job's");
});

test("a catalog job is scheduled only when TMDB has a token; turning it off leaves manual syncs working", async () => {
  const tmdb = await mutableTmdb();
  const idle = await makeApp();
  const idleToken = (await signIn(idle.app)).access;
  await send(idle.app, "PATCH", "/api/jobs/1", { enabled: true, schedule: "150ms" }, idleToken);
  await nap(450);
  assert.equal(pick((await send(idle.app, "GET", "/api/jobs/1", undefined, idleToken)).body, "data.lastRunAt"), undefined, "no token: never scheduled");

  const t = await makeApp({ config: { TMDB_READ_TOKEN: "test-token", TMDB_BASE: tmdb.base } });
  const token = (await signIn(t.app)).access;
  await send(t.app, "PATCH", "/api/jobs/1", { enabled: true, schedule: "150ms", config: { pages: 1 } }, token);
  await until(() => tmdb.calls.includes("/trending/movie/week"), "the scheduled catalog run");
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
  // The earlier scheduled run left "ok" in the status, so wait on the manual run's own call, not on that.
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

  // A manual run that fails (TMDB has no such title) replaces the job's "ok" in the status, and is reported running.
  const started = await send(t.app, "POST", "/api/titles/sync", { scope: "titles", ids: ["movie-999"] }, token);
  assert.deepEqual([started.status, pick(started.body, "data.running")], [202, true]);
  await settled();
  const after = await status();
  assert.notEqual(pick(after, "data.lastOutcome"), "ok", "the manual run's outcome, not the job's");
  assert.equal(typeof pick(after, "data.lastRunAt"), "number");
});

test("the playlist sync status is the most recent run, a job's or a manual one", async () => {
  const { t, token, asked, api } = await setup();
  await api("POST", "/api/playlists", { address: ONE });
  const made = await api("POST", "/api/jobs", { type: "playlist", name: "One", config: { playlistId: 1 } });
  await api("POST", `/api/jobs/${Number(pick(made.body, "data.id"))}/run`, {});
  const status = async () => (await send(t.app, "GET", "/api/playlist-sync", undefined, token)).body;
  assert.equal(pick(await status(), "data.lastOutcome"), "ok");
  assert.equal(pick(await status(), "data.counts.created"), 1);
  // A manual run that cannot reach the playlist replaces the job's outcome.
  await api("PATCH", "/api/playlists/1", { address: "https://down.example/none" });
  const failed = await api("POST", "/api/playlist-sync", {});
  assert.equal(failed.status, 503);
  assert.notEqual(pick(await status(), "data.lastOutcome"), "ok");
  assert.equal(pick(await status(), "data.running"), false);
  assert.equal(asked.length, 1, "only the first address was a playlist");
});
