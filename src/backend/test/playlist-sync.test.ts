import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";

import { makeApp, pick, send, signIn } from "./test-app.js";

const URL_ONE = "https://cdn.example/list.m3u8";

const abcExtinf = '#EXTINF:-1 tvg-id="us-abc" tvg-logo="https://img.example/abc.png" group-title="News",ABC News';

// One duplicate entry (dedupe), one http address (refused), one tvg-chno (the number attribute).
const playlistV1 = [
  "#EXTM3U",
  `${abcExtinf}\nhttps://stream.example/abc.m3u8`,
  `${abcExtinf}\nhttps://stream.example/abc.m3u8`,
  '#EXTINF:-1 group-title="Sports",ESPN Extra\nhttp://insecure.example/espn.m3u8',
  '#EXTINF:-1 tvg-chno="12" group-title="Sports",ESPN\nhttps://stream.example/espn.m3u8',
].join("\n");

// ABC's address moved; ESPN vanished; New Channel appeared.
const playlistV2 = [
  "#EXTM3U",
  `${abcExtinf}\nhttps://stream.example/abc-2.m3u8`,
  '#EXTINF:-1 group-title="Movies",New Channel\nhttps://stream.example/new.m3u8',
].join("\n");

const dirs: string[] = [];
after(() => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }); });

/** Fixture bodies on disk; the injected fetch answers each mapped URL with its file. */
function onDiskFetch(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-playlist-"));
  dirs.push(dir);
  const paths = new Map<string, string>();
  for (const [url, text] of Object.entries(files)) {
    const file = path.join(dir, `fixture-${paths.size}.txt`);
    writeFileSync(file, text, "utf8");
    paths.set(url, file);
  }
  const fetchFromDisk: typeof fetch = async (input) => {
    const file = paths.get(String(input));
    return file === undefined ? new Response("missing", { status: 404 }) : new Response(readFileSync(file, "utf8"));
  };
  return {
    fetch: fetchFromDisk,
    rewrite: (url: string, text: string): void => {
      const file = paths.get(url);
      if (file === undefined) throw new Error(`no fixture for ${url}`);
      writeFileSync(file, text, "utf8");
    },
  };
}

/** A fetch that holds the first run inside itself until released. */
function gatedFetch(text: string) {
  let release!: () => void;
  let resolveStarted!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const started = new Promise<void>((resolve) => (resolveStarted = resolve));
  const hold: typeof fetch = async () => {
    resolveStarted();
    await gate;
    return new Response(text);
  };
  return { fetch: hold, started, release };
}

type Channels = Array<Record<string, unknown>>;

async function channelsOf(t: Awaited<ReturnType<typeof makeApp>>): Promise<Channels> {
  return pick((await send(t.app, "GET", "/api/channels")).body, "data.items") as Channels;
}

async function revisionOf(t: Awaited<ReturnType<typeof makeApp>>): Promise<number> {
  return Number(pick((await send(t.app, "GET", "/healthz")).body, "data.revision"));
}

async function auditOf(t: Awaited<ReturnType<typeof makeApp>>, access: string): Promise<Array<Record<string, unknown>>> {
  return pick((await send(t.app, "GET", "/api/audit?limit=50", undefined, access)).body, "data.items") as Array<Record<string, unknown>>;
}

test("a run creates sync-owned channels, dedupes, refuses http and bumps the revision once", async () => {
  const disk = onDiskFetch({ [URL_ONE]: playlistV1 });
  const t = await makeApp({ fetch: disk.fetch, config: { PLAYLIST_URLS: [URL_ONE] } });
  const access = (await signIn(t.app)).access;
  const hand = await send(t.app, "POST", "/api/channels", { name: "ABC News", category: "Manual", streamUrl: "https://live.example/hand.m3u8" }, access);
  assert.equal(hand.status, 201, "the hand-created row exists first");
  assert.equal(pick((await send(t.app, "POST", "/api/playlist-sync", {})).body, "error.code"), "auth.unauthorized");
  const run = await send(t.app, "POST", "/api/playlist-sync", {}, access);
  assert.equal(run.status, 202);
  assert.equal(pick(run.body, "data.created"), 2);
  assert.equal(pick(run.body, "data.skipped"), 1, "the duplicate entry");
  assert.equal(pick(run.body, "data.refused"), 1, "the http address");
  assert.equal(pick(run.body, "data.refusalExamples.0"), "ESPN Extra (http://insecure.example/espn.m3u8)");
  assert.equal((pick(run.body, "data.createdIds") as string[]).length, 2);
  const items = await channelsOf(t);
  assert.equal(items.length, 3, "the hand-created row is never matched or duplicated onto");
  const abc = items.find((c) => c.name === "ABC News" && c.source === "cdn.example");
  assert.ok(abc !== undefined);
  assert.equal(abc.tvgId, "us-abc");
  assert.equal(abc.category, "News");
  assert.equal(abc.logoUrl, "https://img.example/abc.png");
  const espn = items.find((c) => c.name === "ESPN");
  assert.ok(espn !== undefined);
  assert.equal(espn.number, "12");
  assert.equal(items.some((c) => c.streamUrl === "http://insecure.example/espn.m3u8"), false, "refused never imported");
  assert.equal(items.filter((c) => c.source === undefined).length, 1, "the hand row is untouched");
  assert.equal(await revisionOf(t), 2, "one bump for the hand create, one for the run");
  const imported = (await auditOf(t, access)).find((e) => e.action === "channel.imported");
  assert.ok(imported !== undefined);
  assert.deepEqual((imported.detail as Record<string, unknown>).hosts, ["cdn.example"]);
  assert.ok(!JSON.stringify(imported).includes(URL_ONE), "the audit entry carries the host, never the query");
  await t.dispose();
});

test("a changed entry updates in place; a vanished row is counted, and deleted only with prune", async () => {
  const disk = onDiskFetch({ [URL_ONE]: playlistV1 });
  const t = await makeApp({ fetch: disk.fetch, config: { PLAYLIST_URLS: [URL_ONE] } });
  const access = (await signIn(t.app)).access;
  await send(t.app, "POST", "/api/playlist-sync", {}, access);
  const abcId = String((await channelsOf(t)).find((c) => c.name === "ABC News")?.id);
  assert.equal(await revisionOf(t), 1);
  disk.rewrite(URL_ONE, playlistV2);
  const second = await send(t.app, "POST", "/api/playlist-sync", { prune: false }, access);
  assert.equal(pick(second.body, "data.updated"), 1);
  assert.equal(pick(second.body, "data.removed"), 1, "counted even while it stays");
  assert.equal((await channelsOf(t)).length, 3, "without prune the vanished row stays");
  assert.equal(await revisionOf(t), 2, "one bump for the run, whatever it changed");
  const third = await send(t.app, "POST", "/api/playlist-sync", { prune: true }, access);
  assert.equal(pick(third.body, "data.removed"), 1);
  const items = await channelsOf(t);
  assert.equal(items.length, 2, "prune deletes the vanished row");
  const abc = items.find((c) => c.name === "ABC News");
  assert.equal(abc?.id, abcId, "updated in place, not recreated");
  assert.equal(abc?.streamUrl, "https://stream.example/abc-2.m3u8");
  assert.equal(await revisionOf(t), 3);
  const fourth = await send(t.app, "POST", "/api/playlist-sync", { prune: true }, access);
  const changed = Number(pick(fourth.body, "data.updated")) + Number(pick(fourth.body, "data.removed"));
  assert.equal(changed, 0);
  assert.equal(await revisionOf(t), 3, "a run that changes nothing bumps nothing");
  await t.dispose();
});

test("a dry run computes the counts, writes nothing, and is still audited", async () => {
  const disk = onDiskFetch({ [URL_ONE]: playlistV1 });
  const t = await makeApp({ fetch: disk.fetch, config: { PLAYLIST_URLS: [URL_ONE] } });
  const access = (await signIn(t.app)).access;
  const run = await send(t.app, "POST", "/api/playlist-sync", { dryRun: true }, access);
  assert.equal(run.status, 202);
  assert.equal(pick(run.body, "data.created"), 2);
  assert.deepEqual(pick(run.body, "data.createdIds"), []);
  assert.equal((await channelsOf(t)).length, 0);
  assert.equal(await revisionOf(t), 0);
  assert.ok((await auditOf(t, access)).some((e) => e.action === "channel.imported"));
  await t.dispose();
});

test("a second start while one runs is 409 playlist.busy", async () => {
  const gate = gatedFetch(playlistV1);
  const t = await makeApp({ fetch: gate.fetch, config: { PLAYLIST_URLS: [URL_ONE] } });
  const access = (await signIn(t.app)).access;
  const first = send(t.app, "POST", "/api/playlist-sync", {}, access);
  await gate.started;
  assert.equal(pick((await send(t.app, "GET", "/api/playlist-sync", undefined, access)).body, "data.running"), true);
  const busy = await send(t.app, "POST", "/api/playlist-sync", {}, access);
  assert.equal(busy.status, 409);
  assert.equal(pick(busy.body, "error.code"), "playlist.busy");
  gate.release();
  assert.equal((await first).status, 202);
  await t.dispose();
});

test("PLAYLIST_SYNC_SCHEDULE arms a system run; without playlists it stays unarmed", async () => {
  const disk = onDiskFetch({ [URL_ONE]: playlistV1 });
  const t = await makeApp({ fetch: disk.fetch, config: { PLAYLIST_URLS: [URL_ONE], PLAYLIST_SYNC_SCHEDULE: "120ms" } });
  const access = (await signIn(t.app)).access;
  let settled = false;
  for (let i = 0; i < 200 && !settled; i++) {
    const status = await send(t.app, "GET", "/api/playlist-sync", undefined, access);
    settled = pick(status.body, "data.lastOutcome") === "ok";
    if (!settled) await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.ok(settled, "the scheduled run finished");
  const status = await send(t.app, "GET", "/api/playlist-sync", undefined, access);
  assert.equal(pick(status.body, "data.schedule"), "120ms");
  assert.equal(pick(status.body, "data.counts.created"), 2);
  assert.deepEqual(pick(status.body, "data.playlists"), [{ id: 1, host: "cdn.example", masked: "https://cdn.example/…" }]);
  const imported = (await auditOf(t, access)).find((e) => e.action === "channel.imported");
  assert.ok(imported !== undefined);
  assert.equal(imported.actorEmail ?? null, null, "a scheduled run is audited as system");
  await t.dispose();
  const idle = await makeApp({ config: { PLAYLIST_SYNC_SCHEDULE: "120ms" } });
  const idleAccess = (await signIn(idle.app)).access;
  for (let i = 0; i < 10; i++) {
    const idleStatus = await send(idle.app, "GET", "/api/playlist-sync", undefined, idleAccess);
    assert.equal(pick(idleStatus.body, "data.running"), false);
    assert.equal(pick(idleStatus.body, "data.lastOutcome"), undefined);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  const off = await send(idle.app, "GET", "/api/playlist-sync", undefined, idleAccess);
  assert.equal(pick(off.body, "data.schedule"), "120ms", "shown as stored; no playlists, so nothing ran above");
  await idle.dispose();
});

test("enrichment fills missing logos by tvgId and normalized name; bad playlists fail the run", async () => {
  const playlist = [
    "#EXTM3U",
    '#EXTINF:-1 tvg-id="us-abc" group-title="News",ABC News\nhttps://stream.example/abc.m3u8',
    '#EXTINF:-1 tvg-id="us-xyz" group-title="News",ABCNews HD\nhttps://stream.example/xyz.m3u8',
    '#EXTINF:-1 group-title="News",Mystery TV\nhttps://stream.example/mystery.m3u8',
  ].join("\n");
  const disk = onDiskFetch({
    [URL_ONE]: playlist,
    ["https://iptv-org.github.io/api/logos.json"]: JSON.stringify([
      { channel: "us-abc", url: "https://img.example/index-abc.png", width: 320, height: 180, format: "PNG", in_use: true },
    ]),
    ["https://iptv-org.github.io/api/channels.json"]: JSON.stringify([{ id: "us-abc", name: "ABC News", alt_names: ["ABCNews"] }]),
  });
  const t = await makeApp({ fetch: disk.fetch, config: { PLAYLIST_URLS: [URL_ONE] } });
  const access = (await signIn(t.app)).access;
  assert.equal(pick((await send(t.app, "POST", "/api/playlist-sync", {}, access)).body, "data.created"), 3);
  const items = await channelsOf(t);
  assert.equal(items.find((c) => c.name === "ABC News")?.logoUrl, "https://img.example/index-abc.png", "by tvgId");
  assert.equal(items.find((c) => c.name === "ABCNews HD")?.logoUrl, "https://img.example/index-abc.png", "by normalized name");
  assert.equal("logoUrl" in (items.find((c) => c.name === "Mystery TV") ?? {}), false, "a miss imports the row with no logo");
  await t.dispose();
  const broken = onDiskFetch({ ["https://cdn.example/broken.txt"]: "this is not a playlist" });
  const bad = await makeApp({ fetch: broken.fetch, config: { PLAYLIST_URLS: ["https://cdn.example/broken.txt"] } });
  const invalid = await send(bad.app, "POST", "/api/playlist-sync", {}, (await signIn(bad.app)).access);
  assert.equal(invalid.status, 422);
  assert.equal(pick(invalid.body, "error.code"), "playlist.invalid");
  await bad.dispose();
  const gone = await makeApp({ fetch: onDiskFetch({}).fetch, config: { PLAYLIST_URLS: ["https://gone.example/list.m3u8"] } });
  const unreachable = await send(gone.app, "POST", "/api/playlist-sync", {}, (await signIn(gone.app)).access);
  assert.equal(unreachable.status, 503);
  assert.equal(pick(unreachable.body, "error.code"), "playlist.unreachable");
  await gone.dispose();
});
