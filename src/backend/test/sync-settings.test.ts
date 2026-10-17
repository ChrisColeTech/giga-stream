// The stored sync settings (docs/26 section 3.11): schedules and playlist addresses an admin edits, the environment
// seeding them once, the schedulers re-armed at once, and no address ever echoed. Nothing touches the network.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { mutableTmdb } from "./title-edit-kit.js";
import { makeApp, pick, send, signIn } from "./test-app.js";

const SECRET_URL = "https://cdn.example/list.m3u8?token=SECRET-VALUE";
const OTHER_URL = "https://other.example/all.m3u8";
const M3U = '#EXTM3U\n#EXTINF:-1 tvg-id="a" group-title="News",ABC\nhttps://stream.example/abc.m3u8';

/** A fetch that serves a playlist for any address and remembers which addresses it was asked for. */
function playlistFetch() {
  const asked: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    asked.push(String(input));
    return String(input).includes("m3u8") ? new Response(M3U) : new Response("missing", { status: 404 });
  };
  return { fetchImpl, asked };
}

const nap = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Waits (polling, bounded) until `done()` holds. */
async function until(done: () => boolean | Promise<boolean>, what: string): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    if (await done()) return;
    await nap(15);
  }
  throw new Error(`timed out waiting for ${what}`);
}

test("every route needs a signed-in admin: 401 without a token", async () => {
  const t = await makeApp();
  for (const [method, url, body] of [
    ["GET", "/api/sync-settings", undefined],
    ["PATCH", "/api/sync-settings", { titleSchedule: "6h" }],
    ["POST", "/api/sync-settings/playlists", { url: OTHER_URL }],
    ["DELETE", "/api/sync-settings/playlists/1", undefined],
  ] as const) {
    for (const token of [undefined, "not-a-token"]) {
      const answer = await send(t.app, method, url, body, token);
      assert.deepEqual([answer.status, pick(answer.body, "error.code")], [401, "auth.unauthorized"], `${method} ${url}`);
    }
  }
});

test("the environment seeds the settings; a read shows hosts and masks, never an address", async () => {
  const { fetchImpl } = playlistFetch();
  const t = await makeApp({
    fetch: fetchImpl,
    config: { PLAYLIST_URLS: [SECRET_URL], TMDB_SYNC_SCHEDULE: "6h", PLAYLIST_SYNC_SCHEDULE: "24h" },
  });
  const token = (await signIn(t.app)).access;
  const view = await send(t.app, "GET", "/api/sync-settings", undefined, token);
  assert.deepEqual(pick(view.body, "data"), {
    titleSchedule: "6h",
    playlistSchedule: "24h",
    playlistUrls: [{ id: 1, host: "cdn.example", masked: "https://cdn.example/…" }],
  });
  const reads = [view, await send(t.app, "GET", "/api/playlist-sync", undefined, token), await send(t.app, "GET", "/api/audit", undefined, token)];
  for (const read of reads) assert.equal(JSON.stringify(read.body).includes("SECRET-VALUE"), false);
  assert.deepEqual(pick(reads[1]?.body, "data.playlists"), [{ id: 1, host: "cdn.example", masked: "https://cdn.example/…" }]);
  assert.deepEqual([pick(reads[1]?.body, "data.schedule"), pick((await send(t.app, "GET", "/api/titles/sync", undefined, token)).body, "data.schedule")], ["24h", "6h"]);
});

test("the environment seeds a key on the first start only: after that the stored value wins", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-settings-"));
  try {
    const { fetchImpl } = playlistFetch();
    const first = await makeApp({ dataDir, fetch: fetchImpl, config: { PLAYLIST_URLS: [SECRET_URL], TMDB_SYNC_SCHEDULE: "6h", PLAYLIST_SYNC_SCHEDULE: "12h" } });
    const token = (await signIn(first.app)).access;
    await send(first.app, "PATCH", "/api/sync-settings", { titleSchedule: "off" }, token);
    await first.dispose();
    const second = await makeApp({ dataDir, fetch: fetchImpl, config: { PLAYLIST_URLS: [OTHER_URL], TMDB_SYNC_SCHEDULE: "1h", PLAYLIST_SYNC_SCHEDULE: "2h" } });
    const view = await send(second.app, "GET", "/api/sync-settings", undefined, (await signIn(second.app)).access);
    assert.deepEqual(pick(view.body, "data.titleSchedule"), "off", "an admin's change outlives a restart");
    assert.deepEqual(pick(view.body, "data.playlistSchedule"), "12h");
    assert.deepEqual((pick(view.body, "data.playlistUrls") as Array<Record<string, unknown>>).map((p) => p.host), ["cdn.example"]);
    await second.dispose();
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("a schedule is validated as the environment's is; off is allowed; the value is stored normalised", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  const patch = (body: unknown) => send(t.app, "PATCH", "/api/sync-settings", body, token);
  for (const [body, field] of [
    [{ titleSchedule: "soon" }, "titleSchedule"], [{ playlistSchedule: "6" }, "playlistSchedule"],
    [{ titleSchedule: "5 hours" }, "titleSchedule"], [{ colour: "red" }, "colour"], [{ titleSchedule: 6 }, "titleSchedule"],
    [{ playlistUrls: [] }, "playlistUrls"],
  ] as const) {
    const refused = await patch(body);
    assert.deepEqual([refused.status, pick(refused.body, "error.code"), pick(refused.body, "error.details.field")], [422, "settings.invalid", field], JSON.stringify(body));
  }
  assert.equal(pick((await patch({ titleSchedule: "60m", playlistSchedule: "  30M " })).body, "data.titleSchedule"), "1h");
  assert.equal(pick((await patch({})).body, "data.playlistSchedule"), "30m");
  assert.equal(pick((await patch({ titleSchedule: "off", playlistSchedule: "" })).body, "data.playlistSchedule"), "off");
  const actions = (pick((await send(t.app, "GET", "/api/audit?limit=5", undefined, token)).body, "data.items") as Array<Record<string, unknown>>).map((e) => e.action);
  assert.deepEqual(actions.slice(0, 2), ["settings.sync_updated", "settings.sync_updated"], "an unchanged PATCH writes nothing");
});

test("a playlist is https only, listed once, audited by host alone, and removable", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  const add = (url: unknown) => send(t.app, "POST", "/api/sync-settings/playlists", { url }, token);
  for (const url of ["http://cdn.example/a.m3u8", "ftp://x/a", "not a url", "", "https://user:pw@cdn.example/a.m3u8"]) {
    const refused = await add(url);
    assert.deepEqual([refused.status, pick(refused.body, "error.code"), pick(refused.body, "error.details.field")], [422, "settings.invalid", "url"], url);
  }
  const added = await add(SECRET_URL);
  assert.deepEqual([added.status, pick(added.body, "data")], [201, { id: 1, host: "cdn.example", masked: "https://cdn.example/…" }]);
  assert.equal(pick((await add(SECRET_URL)).body, "error.details.field"), "url", "listed once");
  assert.equal(pick((await add(OTHER_URL)).body, "data.id"), 2);
  const gone = await send(t.app, "DELETE", "/api/sync-settings/playlists/1", undefined, token);
  assert.deepEqual([gone.status, gone.body], [200, { ok: true, data: { id: 1 } }]);
  const missing = await send(t.app, "DELETE", "/api/sync-settings/playlists/1", undefined, token);
  assert.deepEqual([missing.status, pick(missing.body, "error.code")], [404, "settings.playlist_not_found"]);
  assert.equal((await send(t.app, "DELETE", "/api/sync-settings/playlists/abc", undefined, token)).status, 400);
  const audit = await send(t.app, "GET", "/api/audit?limit=10", undefined, token);
  const entries = pick(audit.body, "data.items") as Array<Record<string, unknown>>;
  assert.deepEqual(entries.slice(0, 3).map((e) => [e.action, pick(e, "detail.host")]), [
    ["settings.playlist_removed", "cdn.example"], ["settings.playlist_added", "other.example"], ["settings.playlist_added", "cdn.example"],
  ]);
  assert.equal(JSON.stringify(audit.body).includes("SECRET-VALUE"), false, "never the query");
  assert.equal(JSON.stringify(audit.body).includes("m3u8"), false, "nor the path");
});

test("the playlist sync reads its addresses from the settings at each run", async () => {
  const { fetchImpl, asked } = playlistFetch();
  const t = await makeApp({ fetch: fetchImpl });
  const token = (await signIn(t.app)).access;
  const run = async () => pick((await send(t.app, "POST", "/api/playlist-sync", {}, token)).body, "data.created");
  assert.equal(await run(), 0, "no playlists, nothing to fetch");
  await send(t.app, "POST", "/api/sync-settings/playlists", { url: SECRET_URL }, token);
  assert.equal(await run(), 1);
  assert.ok(asked.includes(SECRET_URL), "the full address is used by the sync alone");
  await send(t.app, "DELETE", "/api/sync-settings/playlists/1", undefined, token);
  const before = asked.length;
  await run();
  assert.equal(asked.length, before, "a removed playlist is not fetched again");
});

test("a playlist schedule re-arms at once on a change; with no playlists it waits for the first", async () => {
  const { fetchImpl, asked } = playlistFetch();
  const t = await makeApp({ fetch: fetchImpl, config: { PLAYLIST_URLS: [OTHER_URL] } });
  const token = (await signIn(t.app)).access;
  const patch = (body: unknown) => send(t.app, "PATCH", "/api/sync-settings", body, token);
  await nap(100);
  assert.equal(asked.length, 0, "stored off: nothing armed");
  await patch({ playlistSchedule: "120ms" });
  await until(() => asked.length >= 2, "scheduled runs");
  await patch({ playlistSchedule: "off" });
  await nap(100);
  const stopped = asked.length;
  await nap(350);
  assert.equal(asked.length, stopped, "off clears the timer");

  await send(t.app, "DELETE", "/api/sync-settings/playlists/1", undefined, token);
  await patch({ playlistSchedule: "120ms" });
  await nap(350);
  assert.equal(asked.length, stopped, "a schedule with no playlists stays unarmed");
  await send(t.app, "POST", "/api/sync-settings/playlists", { url: SECRET_URL }, token);
  await until(() => asked.length > stopped, "the first playlist arms it");
  await send(t.app, "DELETE", "/api/sync-settings/playlists/2", undefined, token);
  await nap(100);
  const emptied = asked.length;
  await nap(350);
  assert.equal(asked.length, emptied, "removing the last playlist disarms it");
});

test("a title schedule re-arms at once on a change, and turning it off leaves manual syncs working", async () => {
  const tmdb = await mutableTmdb();
  const t = await makeApp({ config: { TMDB_READ_TOKEN: "test-token", TMDB_BASE: tmdb.base } });
  const token = (await signIn(t.app)).access;
  const patch = (body: unknown) => send(t.app, "PATCH", "/api/sync-settings", body, token);
  await patch({ titleSchedule: "150ms" });
  await until(() => tmdb.calls.includes("/trending/movie/week"), "the scheduled warm-up");
  await patch({ titleSchedule: "off" });
  await nap(150);
  const stopped = tmdb.calls.length;
  await nap(450);
  assert.equal(tmdb.calls.length, stopped, "off clears the timer");
  assert.equal(pick((await send(t.app, "GET", "/api/titles/sync", undefined, token)).body, "data.schedule"), "off");
  tmdb.calls.length = 0;
  const started = await send(t.app, "POST", "/api/titles/sync", { scope: "trending", kind: "movie", pages: 1 }, token);
  assert.equal(started.status, 202);
  await until(async () => pick((await send(t.app, "GET", "/api/titles/sync", undefined, token)).body, "data.lastOutcome") === "ok", "a manual sync");
  assert.ok(tmdb.calls.includes("/trending/movie/week"), "the manual sync ran after the schedule was turned off");
});
