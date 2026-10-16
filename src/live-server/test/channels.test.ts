// The channel CRUD routes over the real store and the real runtime: each created or changed channel is
// read with ffprobe and encoded (cached across runs in TEST_CACHE_DIR), then streamed.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { before, test } from "node:test";

import { closeServer, fixture, fixtures, makeServer, pick, send } from "./test-app.ts";

let dir = "";
before(async () => {
  dir = await fixtures();
});

const channel = (overrides: Record<string, unknown> = {}) => ({
  id: "home",
  name: "Home Videos",
  category: "Entertainment",
  number: 7,
  videos: [fixture(dir, "kids", 1), fixture(dir, "music", 1)],
  ...overrides,
});

test("a new channel answers preparing, then plays its videos in order once ready", async () => {
  const server = await makeServer();
  assert.deepEqual(pick((await send(server, "GET", "/api/channels")).body, "data"), []);
  const created = await send(server, "POST", "/api/channels", { body: channel() });
  assert.equal(created.status, 201);
  assert.deepEqual(pick(created.body, "data.state"), "preparing");
  assert.deepEqual(pick(created.body, "data.variants"), ["360p", "720p"]);
  assert.equal(pick(created.body, "data.masterUrl"), "http://localhost:80/live/home/master.m3u8");
  await server.services.settled();
  const read = await send(server, "GET", "/api/channels/home");
  assert.equal(pick(read.body, "data.state"), "live");
  assert.deepEqual(pick(read.body, "data.playlist"), [
    { name: "kids-1.mp4", durationMs: pick(read.body, "data.playlist.0.durationMs") },
    { name: "music-1.mp4", durationMs: pick(read.body, "data.playlist.1.durationMs") },
  ]);
  assert.equal(pick(read.body, "data.nowPlaying.name"), "kids-1.mp4");
  const master = await send(server, "GET", "/live/home/master.m3u8");
  assert.equal(master.status, 200);
  assert.match(master.raw.toString(), /RESOLUTION=1280x720/);
});

test("a folder channel plays every video in the folder, in path order", async () => {
  const server = await makeServer();
  const folder = path.join(dir, "live");
  await send(server, "POST", "/api/channels", { body: channel({ videos: undefined, folder }) });
  await server.services.settled();
  const playlist = pick((await send(server, "GET", "/api/channels/home")).body, "data.playlist");
  assert.ok(Array.isArray(playlist));
  assert.equal(playlist.length, 12);
  assert.deepEqual(playlist.map((entry) => pick(entry, "name")).slice(0, 4), ["kids-1.mp4", "kids-2.mp4", "kids-3.mp4", "music-1.mp4"]);
});

test("an edit is live at once: renamed, reordered, then switched from a list to a folder and back", async () => {
  const server = await makeServer();
  await send(server, "POST", "/api/channels", { body: channel() });
  await server.services.settled();
  const renamed = await send(server, "PATCH", "/api/channels/home", { body: { name: "Family", number: 8 } });
  assert.deepEqual([pick(renamed.body, "data.name"), pick(renamed.body, "data.number")], ["Family", 8]);
  const reordered = await send(server, "PATCH", "/api/channels/home", {
    body: { videos: [fixture(dir, "music", 1), fixture(dir, "kids", 1)] },
  });
  assert.equal(pick(reordered.body, "data.state"), "preparing");
  await server.services.settled();
  const after = (await send(server, "GET", "/api/channels/home")).body;
  assert.deepEqual([pick(after, "data.playlist.0.name"), pick(after, "data.state")], ["music-1.mp4", "live"]);
  const toFolder = await send(server, "PATCH", "/api/channels/home", { body: { folder: path.join(dir, "live") } });
  assert.deepEqual([pick(toFolder.body, "data.folder"), pick(toFolder.body, "data.videos")], [path.join(dir, "live"), undefined]);
  const back = await send(server, "PATCH", "/api/channels/home", { body: { videos: [fixture(dir, "kids", 1)] } });
  assert.equal(pick(back.body, "data.folder"), undefined);
  await server.services.settled();
});

test("channels persist in the database across a restart and start again", async () => {
  const first = await makeServer();
  await send(first, "POST", "/api/channels", { body: channel() });
  await first.services.settled();
  await closeServer(first);
  const second = await makeServer({ dataDir: first.dataDir });
  await second.services.settled();
  const read = await send(second, "GET", "/api/channels/home");
  assert.deepEqual([pick(read.body, "data.name"), pick(read.body, "data.state")], ["Home Videos", "live"]);
});

test("delete stops the channel and its stream", async () => {
  const server = await makeServer();
  await send(server, "POST", "/api/channels", { body: channel() });
  await server.services.settled();
  assert.deepEqual(pick((await send(server, "DELETE", "/api/channels/home")).body, "data"), { id: "home" });
  assert.equal(pick((await send(server, "GET", "/api/channels/home")).body, "error.code"), "channel.not_found");
  assert.equal((await send(server, "GET", "/live/home/master.m3u8")).status, 404);
  assert.equal((await send(server, "DELETE", "/api/channels/home")).status, 404);
});

test("bad channels are refused with the field named; taken ids and numbers are conflicts", async () => {
  const server = await makeServer();
  const refusal = async (body: unknown) => {
    const answer = await send(server, "POST", "/api/channels", { body });
    return [answer.status, pick(answer.body, "error.code"), pick(answer.body, "error.details.field")];
  };
  assert.deepEqual(await refusal(channel({ id: "Bad Id" })), [422, "channel.invalid", "id"]);
  assert.deepEqual(await refusal(channel({ folder: dir })), [422, "channel.invalid", "folder"]);
  assert.deepEqual(await refusal(channel({ videos: undefined })), [422, "channel.invalid", "folder"]);
  assert.deepEqual(await refusal(channel({ videos: ["relative/a.mp4"] })), [422, "channel.invalid", "videos.0"]);
  assert.deepEqual(await refusal(channel({ videos: [path.join(dir, "nope.mp4")] })), [422, "channel.invalid", "videos.0"]);
  assert.deepEqual(await refusal(channel({ videos: undefined, folder: path.join(dir, "nope") })), [422, "channel.invalid", "folder"]);
  assert.deepEqual(await refusal(channel({ variants: ["720p"] })), [422, "channel.invalid", "variants"]);
  assert.deepEqual(await refusal(channel({ category: "Weather" })), [422, "channel.invalid", "category"]);
  assert.deepEqual(await refusal(channel({ colour: "red" })), [422, "channel.invalid", "colour"]);
  assert.equal((await send(server, "POST", "/api/channels", { body: channel() })).status, 201);
  assert.deepEqual(await refusal(channel({ number: 99 })), [409, "channel.taken", "id"]);
  assert.deepEqual(await refusal(channel({ id: "other" })), [409, "channel.taken", "number"]);
  const patch = await send(server, "PATCH", "/api/channels/home", { body: { id: "renamed" } });
  assert.deepEqual([patch.status, pick(patch.body, "error.details.field")], [422, "id"]);
  await server.services.settled();
});

test("a video that cannot be played leaves the channel failed with the reason", async () => {
  const server = await makeServer();
  const folder = mkdtempSync(path.join(os.tmpdir(), "giga-live-broken-"));
  const broken = path.join(folder, "broken.mp4");
  writeFileSync(broken, "not a video");
  await send(server, "POST", "/api/channels", { body: channel({ videos: [fixture(dir, "kids", 1), broken] }) });
  await server.services.settled();
  const read = (await send(server, "GET", "/api/channels/home")).body;
  assert.equal(pick(read, "data.state"), "failed");
  assert.match(String(pick(read, "data.problem")), /broken\.mp4 cannot be played/);
});

test("reads are open to the network; changes only from this computer", async () => {
  const server = await makeServer();
  const lan = { address: "192.168.1.20" };
  assert.equal((await send(server, "GET", "/api/channels", lan)).status, 200);
  const refused = await send(server, "POST", "/api/channels", { ...lan, body: channel() });
  assert.deepEqual([refused.status, pick(refused.body, "error.code")], [403, "access.loopback_only"]);
  assert.equal((await send(server, "DELETE", "/api/channels/home", lan)).status, 403);
});
