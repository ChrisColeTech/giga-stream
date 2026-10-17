// Sync jobs are records (docs/26 section 3.11): type, `Enabled`, schedule, config; CRUD, run, single flight, the
// refusal of a disabled job, and the first-start seed. Nothing touches the network.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { itemsOf } from "./live-channel-kit.js";
import { makeApp, pick, send, signIn } from "./test-app.js";
import { mutableTmdb } from "./title-edit-kit.js";

const URL_ONE = "https://cdn.example/list.m3u8?token=SECRET-VALUE";
const M3U = [
  "#EXTM3U",
  '#EXTINF:-1 tvg-id="a" group-title="News",ABC\nhttps://stream.example/abc.m3u8',
  '#EXTINF:-1 group-title="Sports",ESPN\nhttps://stream.example/espn.m3u8',
].join("\n");

/** A fetch that serves the playlist, remembers what it was asked, and can hold the first answer until released. */
function playlistFetch(hold = false) {
  const asked: string[] = [];
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const fetchImpl: typeof fetch = async (input) => {
    // Only the playlists count: the logo index is fetched through here too.
    if (String(input).includes("m3u8")) asked.push(String(input));
    if (hold) await gate;
    return String(input).includes("m3u8") ? new Response(M3U) : new Response("missing", { status: 404 });
  };
  return { fetchImpl, asked, release: () => release() };
}

async function setup(options: { hold?: boolean; config?: Record<string, unknown> } = {}) {
  const feed = playlistFetch(options.hold);
  const t = await makeApp({ fetch: feed.fetchImpl, config: options.config ?? {} });
  const token = (await signIn(t.app)).access;
  const playlist = (address = URL_ONE) => send(t.app, "POST", "/api/playlists", { address }, token);
  const job = (body: unknown) => send(t.app, "POST", "/api/jobs", body, token);
  const playlistJob = (extra: Record<string, unknown> = {}) =>
    job({ type: "playlist", name: "Sync it", config: { playlistId: 1 }, ...extra });
  return { t, token, feed, playlist, job, playlistJob };
}

test("every route needs a signed-in admin: 401 without a token", async () => {
  const { t } = await setup();
  for (const [method, url, body] of [
    ["GET", "/api/jobs", undefined], ["POST", "/api/jobs", { type: "catalog", name: "x", config: { scope: "trending", kind: "movie" } }],
    ["GET", "/api/jobs/1", undefined], ["PATCH", "/api/jobs/1", { enabled: false }],
    ["DELETE", "/api/jobs/1", undefined], ["POST", "/api/jobs/1/run", {}],
  ] as const) {
    for (const token of [undefined, "not-a-token"]) {
      const answer = await send(t.app, method, url, body, token);
      assert.deepEqual([answer.status, pick(answer.body, "error.code")], [401, "auth.unauthorized"], `${method} ${url}`);
    }
  }
});

test("the environment seeds the playlists and jobs on the first start only; the records are the truth after", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-jobs-"));
  try {
    const { fetchImpl } = playlistFetch();
    const first = await makeApp({
      dataDir, fetch: fetchImpl,
      config: { PLAYLIST_URLS: [URL_ONE], PLAYLIST_SYNC_SCHEDULE: "6h", TMDB_SYNC_SCHEDULE: "12h" },
    });
    const token = (await signIn(first.app)).access;
    const jobs = itemsOf((await send(first.app, "GET", "/api/jobs", undefined, token)).body);
    assert.deepEqual(jobs.map((j) => [j.type, j.enabled, j.schedule]), [
      ["playlist", true, "6h"], ["catalog", true, "12h"], ["catalog", true, "12h"], ["catalog", true, "12h"], ["catalog", true, "12h"],
    ]);
    assert.deepEqual(jobs[0]?.config, { playlistId: 1, dryRun: false, prune: false });
    assert.deepEqual(jobs.slice(1).map((j) => j.config), [
      { scope: "trending", kind: "movie", pages: 5 }, { scope: "trending", kind: "tv", pages: 5 },
      { scope: "popular", kind: "movie", pages: 5 }, { scope: "popular", kind: "tv", pages: 5 },
    ]);
    const playlists = itemsOf((await send(first.app, "GET", "/api/playlists", undefined, token)).body);
    assert.deepEqual(playlists.map((p) => [p.host, p.enabled]), [["cdn.example", true]]);
    assert.equal(JSON.stringify(playlists).includes("SECRET-VALUE"), false);
    await send(first.app, "PATCH", "/api/jobs/1", { schedule: "30m", enabled: false }, token);
    for (const job of jobs.slice(1)) await send(first.app, "DELETE", `/api/jobs/${job.id}`, undefined, token);
    await send(first.app, "DELETE", "/api/playlists/1", undefined, token);
    await first.dispose();

    const second = await makeApp({
      dataDir, fetch: fetchImpl,
      config: { PLAYLIST_URLS: ["https://other.example/x.m3u8"], PLAYLIST_SYNC_SCHEDULE: "1h", TMDB_SYNC_SCHEDULE: "2h" },
    });
    const again = (await signIn(second.app)).access;
    assert.deepEqual(itemsOf((await send(second.app, "GET", "/api/jobs", undefined, again)).body).length, 0, "not seeded again");
    assert.deepEqual(itemsOf((await send(second.app, "GET", "/api/playlists", undefined, again)).body).length, 0);
    await second.dispose();
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("with nothing in the environment the seed makes the four catalog jobs, off", async () => {
  const { t, token } = await setup();
  const jobs = itemsOf((await send(t.app, "GET", "/api/jobs", undefined, token)).body);
  assert.deepEqual(jobs.map((j) => [j.name, j.enabled, j.schedule]), [
    ["Trending movies", false, "off"], ["Trending series", false, "off"], ["Popular movies", false, "off"], ["Popular series", false, "off"],
  ]);
});

test("a job is created, read, changed and deleted; every refusal names its field", async () => {
  const { t, token, playlist, job, playlistJob } = await setup();
  await playlist();
  const made = await playlistJob({ schedule: "60m", config: { playlistId: 1, prune: true } });
  assert.deepEqual(
    ["type", "enabled", "schedule", "config", "playlistName", "running"].map((f) => pick(made.body, `data.${f}`)),
    ["playlist", true, "1h", { playlistId: 1, dryRun: false, prune: true }, "cdn.example", false],
  );
  const id = Number(pick(made.body, "data.id"));
  const catalog = await job({ type: "catalog", name: "Series", schedule: "6h", enabled: false, config: { scope: "popular", kind: "tv" } });
  assert.deepEqual([catalog.status, pick(catalog.body, "data.config"), pick(catalog.body, "data.enabled")], [201, { scope: "popular", kind: "tv", pages: 5 }, false]);

  const refusal = async (body: unknown) => {
    const answer = await job(body);
    return [answer.status, pick(answer.body, "error.code"), pick(answer.body, "error.details.field")];
  };
  const bad = (field: string) => [422, "job.invalid", field];
  const catalogBody = (over: Record<string, unknown>) => ({ type: "catalog", name: "x", config: { scope: "trending", kind: "movie" }, ...over });
  assert.deepEqual(await refusal(catalogBody({ type: "radio" })), bad("type"));
  assert.deepEqual(await refusal(catalogBody({ schedule: "soon" })), bad("schedule"));
  assert.deepEqual(await refusal(catalogBody({ config: { scope: "newest", kind: "movie" } })), bad("config.scope"));
  assert.deepEqual(await refusal(catalogBody({ config: { scope: "trending", kind: "movie", pages: 99 } })), bad("config.pages"));
  assert.deepEqual(await refusal(catalogBody({ colour: "red" })), bad("colour"));
  assert.deepEqual(await refusal({ type: "playlist", name: "x", config: { playlistId: 9 } }), bad("config.playlistId"));
  assert.deepEqual(await refusal({ type: "playlist", name: "", config: { playlistId: 1 } }), bad("name"));

  const patch = (body: unknown, target = id) => send(t.app, "PATCH", `/api/jobs/${target}`, body, token);
  const changed = await patch({ name: "Renamed", enabled: false, schedule: "30m", config: { dryRun: true } });
  assert.deepEqual(
    ["name", "enabled", "schedule", "config"].map((f) => pick(changed.body, `data.${f}`)),
    ["Renamed", false, "30m", { playlistId: 1, dryRun: true, prune: true }],
  );
  assert.equal(pick((await patch({ schedule: "never" })).body, "error.details.field"), "schedule");
  assert.equal(pick((await patch({ config: { playlistId: 9 } })).body, "error.details.field"), "config.playlistId");
  assert.equal(pick((await patch({ config: { scope: "popular" } })).body, "error.details.field"), "config.scope", "a playlist job has no scope");
  assert.equal((await patch({ type: "catalog" })).status, 422, "the type never changes");
  assert.equal((await patch({ name: "x" }, 99)).status, 404);

  assert.deepEqual((await send(t.app, "DELETE", `/api/jobs/${id}`, undefined, token)).body, { ok: true, data: { id } });
  const missing = await send(t.app, "GET", `/api/jobs/${id}`, undefined, token);
  assert.deepEqual([missing.status, pick(missing.body, "error.code")], [404, "job.not_found"]);
  const actions = (pick((await send(t.app, "GET", "/api/audit?limit=20", undefined, token)).body, "data.items") as Array<Record<string, unknown>>).map((e) => e.action);
  assert.deepEqual(actions.filter((a) => String(a).startsWith("job.")), ["job.deleted", "job.updated", "job.created", "job.created"]);
});

test("running a playlist job syncs only its playlist and keeps how it went; a dry run writes nothing", async () => {
  const { t, token, feed, playlist, playlistJob } = await setup();
  await playlist();
  await playlist("https://other.example/all.m3u8");
  const id = Number(pick((await playlistJob()).body, "data.id"));
  const dry = await send(t.app, "POST", `/api/jobs/${id}/run`, { dryRun: true }, token);
  const dryCounts = [pick(dry.body, "data.lastCounts.created"), pick(dry.body, "data.lastCounts.createdIds")];
  assert.deepEqual([dry.status, pick(dry.body, "data.lastOutcome")], [202, "Dry run. 2 to create, 0 to update."]);
  assert.deepEqual(dryCounts, [2, []], "a dry run names no created id");
  assert.equal(itemsOf((await send(t.app, "GET", "/api/channels")).body).length, 0, "a dry run writes nothing");
  const real = await send(t.app, "POST", `/api/jobs/${id}/run`, undefined, token);
  assert.deepEqual([pick(real.body, "data.lastCounts.created"), pick(real.body, "data.running")], [2, false]);
  assert.equal(pick(real.body, "data.lastOutcome"), "Synced: 2 created, 0 updated.");
  const createdIds = pick(real.body, "data.lastCounts.createdIds");
  assert.ok(Array.isArray(createdIds) && createdIds.length === 2, "the two created ids are kept");
  const examples = pick(real.body, "data.lastCounts.refusalExamples");
  assert.ok(Array.isArray(examples), "refusal examples are kept, even when empty");
  assert.deepEqual(feed.asked, [URL_ONE, URL_ONE], "never the other playlist");
  assert.equal(pick((await send(t.app, "GET", "/api/playlists/1", undefined, token)).body, "data.channels"), 2);
  assert.equal(pick((await send(t.app, "GET", "/api/playlists/2", undefined, token)).body, "data.channels"), 0);
  assert.equal(JSON.stringify(real.body).includes("SECRET-VALUE"), false);
  assert.equal(pick((await send(t.app, "POST", `/api/jobs/${id}/run`, { prune: "yes" }, token)).body, "error.details.field"), "prune");
  assert.equal((await send(t.app, "POST", "/api/jobs/99/run", {}, token)).status, 404);
});

test("a job that is disabled, or whose playlist is, is refused with its reason; a busy job is 409", async () => {
  const { t, token, feed, playlist, playlistJob } = await setup({ hold: true });
  await playlist();
  const id = Number(pick((await playlistJob({ enabled: false })).body, "data.id"));
  const refusedJob = await send(t.app, "POST", `/api/jobs/${id}/run`, {}, token);
  assert.deepEqual([refusedJob.status, pick(refusedJob.body, "error.code")], [422, "job.disabled"]);
  assert.match(String(pick(refusedJob.body, "error.message")), /job is disabled/);
  await send(t.app, "PATCH", `/api/jobs/${id}`, { enabled: true }, token);
  await send(t.app, "PATCH", "/api/playlists/1", { enabled: false }, token);
  const refusedPlaylist = await send(t.app, "POST", `/api/jobs/${id}/run`, {}, token);
  assert.deepEqual([refusedPlaylist.status, pick(refusedPlaylist.body, "error.code")], [422, "job.disabled"]);
  assert.match(String(pick(refusedPlaylist.body, "error.message")), /playlist is disabled/);
  assert.deepEqual(feed.asked, [], "nothing was fetched");

  await send(t.app, "PATCH", "/api/playlists/1", { enabled: true }, token);
  const first = send(t.app, "POST", `/api/jobs/${id}/run`, {}, token);
  for (let i = 0; i < 100 && feed.asked.length === 0; i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(pick((await send(t.app, "GET", `/api/jobs/${id}`, undefined, token)).body, "data.running"), true);
  const second = await send(t.app, "POST", `/api/jobs/${id}/run`, {}, token);
  assert.deepEqual([second.status, pick(second.body, "error.code")], [409, "sync.busy"]);
  feed.release();
  assert.equal((await first).status, 202);
});

test("running a catalog job starts it and keeps its outcome and the titles it pulled", async () => {
  const tmdb = await mutableTmdb();
  const t = await makeApp({ config: { TMDB_READ_TOKEN: "test-token", TMDB_BASE: tmdb.base } });
  const token = (await signIn(t.app)).access;
  const jobs = itemsOf((await send(t.app, "GET", "/api/jobs", undefined, token)).body);
  const id = Number(jobs[0]?.id);
  assert.equal((await send(t.app, "POST", `/api/jobs/${id}/run`, {}, token)).status, 422, "seeded off: disabled");
  await send(t.app, "PATCH", `/api/jobs/${id}`, { enabled: true, config: { pages: 1 } }, token);
  const started = await send(t.app, "POST", `/api/jobs/${id}/run`, {}, token);
  assert.equal(started.status, 202);
  const read = async () => pick((await send(t.app, "GET", `/api/jobs/${id}`, undefined, token)).body, "data") as Record<string, unknown>;
  for (let i = 0; i < 200 && (await read()).lastOutcome === undefined; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  const done = await read();
  assert.deepEqual([done.lastOutcome, pick(done, "lastCounts.titles"), done.running], ["ok", 1, false]);
  assert.ok(tmdb.calls.includes("/trending/movie/week"));
});
