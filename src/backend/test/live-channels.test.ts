// The channel routes with a live row (docs/26 section 3.3) over the real store and a fake stream: no program runs.
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { z } from "zod";

import { itemOf, itemsOf, liveBody, streamBody, VIDEOS } from "./live-channel-kit.js";
import { makeApp, pick, request, send, signIn } from "./test-app.js";

async function owner() {
  const t = await makeApp();
  return { t, token: (await signIn(t.app)).access };
}

/** The consumer contract: the fileserver's `ChannelSchema` (src/fileserver/src/services/admin-client.ts). */
const FileserverChannel = z.object({
  id: z.string().min(1),
  name: z.string(),
  category: z.string(),
  number: z.string().optional(),
  logoUrl: z.string().optional(),
  revision: z.number(),
  streamUrl: z.string().min(1),
});

test("a new live channel answers preparing with its defaults, then plays its videos in order", async () => {
  const { t, token } = await owner();
  const created = await send(t.app, "POST", "/api/channels", liveBody(), token);
  assert.equal(created.status, 201);
  assert.deepEqual(
    ["kind", "state", "mode", "captions", "variants", "number"].map((field) => pick(created.body, `data.${field}`)),
    ["live", "preparing", "loop", false, ["360p", "720p"], "7"],
  );
  assert.equal(pick(created.body, "data.streamUrl"), "http://localhost:80/live/home/master.m3u8");
  await t.live.settled();
  const admin = await send(t.app, "GET", "/api/admin-channels", undefined, token);
  const home = itemOf(admin.body, "home");
  assert.deepEqual([home.state, home.problem, home.nowPlaying], ["live", undefined, { index: 0, name: "a.mp4" }]);
  assert.deepEqual(home.playlist, [{ name: "a.mp4", durationMs: 6000 }, { name: "b.mp4", durationMs: 4000 }]);
  assert.deepEqual([home.folder, home.videos, home.fault], [undefined, [VIDEOS.a, VIDEOS.b], null]);
});

test("a public read builds a live row's addresses from the caller's origin and shows no local path", async () => {
  const { t, token } = await owner();
  await send(t.app, "POST", "/api/channels", liveBody(), token);
  const lan = await request(t.app, { method: "GET", url: "/api/channels", headers: { host: "stream.example:9000" } });
  assert.deepEqual(itemOf(lan.body, "home"), {
    id: "home",
    name: "Home Videos",
    category: "Entertainment",
    number: "7",
    kind: "live",
    streamUrl: "http://stream.example:9000/live/home/master.m3u8",
    logoUrl: "http://stream.example:9000/logos/home.png",
    revision: 1,
  });
  const here = await request(t.app, { method: "GET", url: "/api/channels/home", headers: { host: "127.0.0.1:8091" } });
  assert.equal(pick(here.body, "data.streamUrl"), "http://127.0.0.1:8091/live/home/master.m3u8");
});

test("both kinds answer the shape the fileserver reads: number is text, streamUrl is not empty", async () => {
  const { t, token } = await owner();
  await send(t.app, "POST", "/api/channels", liveBody(), token);
  await send(t.app, "POST", "/api/channels", streamBody({ logoUrl: "https://live.example/news.png" }), token);
  const list = await send(t.app, "GET", "/api/channels");
  assert.deepEqual(itemsOf(list.body).map((item) => item.kind).sort(), ["live", "stream"]);
  for (const item of itemsOf(list.body)) assert.equal(FileserverChannel.safeParse(item).success, true, String(item.id));
  assert.equal(pick(list.body, "data.revision"), 2);
});

test("a body without a kind is a stream row; the kind discriminates, and a field of the other kind is refused", async () => {
  const { t, token } = await owner();
  const plain = await send(t.app, "POST", "/api/channels", streamBody(), token);
  assert.deepEqual([plain.status, pick(plain.body, "data.kind"), pick(plain.body, "data.streamUrl")], [201, "stream", "https://live.example/news.m3u8"]);
  const named = await send(t.app, "POST", "/api/channels", streamBody({ kind: "stream", number: "9" }), token);
  assert.equal(named.status, 201);
  const refusal = async (body: unknown) => {
    const answer = await send(t.app, "POST", "/api/channels", body, token);
    return [answer.status, pick(answer.body, "error.code"), pick(answer.body, "error.details.field")];
  };
  assert.deepEqual(await refusal(streamBody({ kind: "radio" })), [422, "channel.invalid", "kind"]);
  assert.deepEqual(await refusal(streamBody({ mode: "loop" })), [422, "channel.invalid", "mode"]);
  assert.deepEqual(await refusal(liveBody({ streamUrl: "https://x.example/a.m3u8" })), [422, "channel.invalid", "streamUrl"]);
  assert.deepEqual(await refusal(liveBody({ logoUrl: "https://x.example/a.png" })), [422, "channel.invalid", "logoUrl"]);
  // The address rule of docs/03 7.3 applies to stream rows only.
  assert.deepEqual(await refusal(streamBody({ streamUrl: "http://live.example/news.m3u8" })), [422, "channel.invalid", "streamUrl"]);
});

test("a bad live channel is refused naming the field; its paths must exist", async () => {
  const { t, token } = await owner();
  const refusal = async (body: unknown) => {
    const answer = await send(t.app, "POST", "/api/channels", body, token);
    return [answer.status, pick(answer.body, "error.code"), pick(answer.body, "error.details.field")];
  };
  const invalid = (field: string) => [422, "channel.invalid", field];
  assert.deepEqual(await refusal(liveBody({ id: "Bad Id" })), invalid("id"));
  assert.deepEqual(await refusal(liveBody({ folder: VIDEOS.folder })), invalid("folder"));
  assert.deepEqual(await refusal(liveBody({ videos: undefined })), invalid("folder"));
  assert.deepEqual(await refusal(liveBody({ videos: ["relative/a.mp4"] })), invalid("videos.0"));
  assert.deepEqual(await refusal(liveBody({ videos: [VIDEOS.a, path.join(VIDEOS.dir, "nope.mp4")] })), invalid("videos.1"));
  assert.deepEqual(await refusal(liveBody({ videos: undefined, folder: path.join(VIDEOS.dir, "nope") })), invalid("folder"));
  assert.deepEqual(await refusal(liveBody({ variants: ["720p"] })), invalid("variants"));
  assert.deepEqual(await refusal(liveBody({ variants: ["720p", "720p"] })), invalid("variants"));
  assert.deepEqual(await refusal(liveBody({ category: "Weather" })), invalid("category"));
  assert.deepEqual(await refusal(liveBody({ colour: "red" })), invalid("colour"));
  for (const number of [0, 10_000, 1.5, "abc", "12345", true]) assert.deepEqual(await refusal(liveBody({ number })), invalid("number"));
  assert.equal(itemsOf((await send(t.app, "GET", "/api/channels")).body).length, 0);
});

test("a live number is text on the wire: digits or an integer are accepted and kept without leading zeros", async () => {
  const { t, token } = await owner();
  const answer = await send(t.app, "POST", "/api/channels", liveBody({ number: "0012" }), token);
  assert.deepEqual([answer.status, pick(answer.body, "data.number")], [201, "12"]);
});

test("a taken id or live number is channel.taken; stream rows share numbers freely", async () => {
  const { t, token } = await owner();
  assert.equal((await send(t.app, "POST", "/api/channels", liveBody(), token)).status, 201);
  const refusal = async (body: unknown) => {
    const answer = await send(t.app, "POST", "/api/channels", body, token);
    return [answer.status, pick(answer.body, "error.code"), pick(answer.body, "error.details.field")];
  };
  assert.deepEqual(await refusal(liveBody({ number: 99 })), [409, "channel.taken", "id"]);
  assert.deepEqual(await refusal(liveBody({ id: "other" })), [409, "channel.taken", "number"]);
  assert.equal((await send(t.app, "POST", "/api/channels", streamBody({ number: "7" }), token)).status, 201);
  assert.equal((await send(t.app, "POST", "/api/channels", streamBody({ number: "7" }), token)).status, 201);
  assert.equal((await send(t.app, "POST", "/api/channels", liveBody({ id: "two", number: 8 }), token)).status, 201);
  const clash = await send(t.app, "PATCH", "/api/channels/two", { number: "7" }, token);
  assert.deepEqual([clash.status, pick(clash.body, "error.code"), pick(clash.body, "error.details.field")], [409, "channel.taken", "number"]);
  assert.equal((await send(t.app, "PATCH", "/api/channels/two", { number: "8" }, token)).status, 200);
});

test("an edit is live at once: renamed, reordered, then switched from a list to a folder and back", async () => {
  const { t, token } = await owner();
  await send(t.app, "POST", "/api/channels", liveBody(), token);
  await t.live.settled();
  const renamed = await send(t.app, "PATCH", "/api/channels/home", { kind: "live", name: "Family", number: 8 }, token);
  assert.deepEqual(["name", "number", "state"].map((f) => pick(renamed.body, `data.${f}`)), ["Family", "8", "preparing"]);
  const reordered = await send(t.app, "PATCH", "/api/channels/home", { videos: [VIDEOS.b, VIDEOS.a] }, token);
  assert.deepEqual(pick(reordered.body, "data.videos"), [VIDEOS.b, VIDEOS.a]);
  await t.live.settled();
  const toFolder = await send(t.app, "PATCH", "/api/channels/home", { folder: VIDEOS.folder, captions: true, mode: "encode" }, token);
  assert.deepEqual(["folder", "videos", "captions", "mode"].map((f) => pick(toFolder.body, `data.${f}`)), [VIDEOS.folder, undefined, true, "encode"]);
  const back = await send(t.app, "PATCH", "/api/channels/home", { videos: [VIDEOS.a] }, token);
  assert.deepEqual([pick(back.body, "data.folder"), pick(back.body, "data.videos")], [undefined, [VIDEOS.a]]);
  await t.live.settled();
  assert.equal(pick((await send(t.app, "GET", "/api/channels/home")).body, "data.name"), "Family");
});

test("a change is refused when it does not fit the row: the kind, the other kind's fields, the id, the category", async () => {
  const { t, token } = await owner();
  await send(t.app, "POST", "/api/channels", liveBody(), token);
  const stream = String(pick((await send(t.app, "POST", "/api/channels", streamBody(), token)).body, "data.id"));
  const refusal = async (id: string, body: unknown) => {
    const answer = await send(t.app, "PATCH", `/api/channels/${id}`, body, token);
    return [answer.status, pick(answer.body, "error.code"), pick(answer.body, "error.details.field")];
  };
  const invalid = (field: string) => [422, "channel.invalid", field];
  assert.deepEqual(await refusal("home", { kind: "stream" }), invalid("kind"));
  assert.deepEqual(await refusal(stream, { kind: "live" }), invalid("kind"));
  assert.deepEqual(await refusal("home", { streamUrl: "https://x.example/a.m3u8" }), invalid("streamUrl"));
  assert.deepEqual(await refusal("home", { logoUrl: "https://x.example/a.png" }), invalid("logoUrl"));
  assert.deepEqual(await refusal(stream, { mode: "encode" }), invalid("mode"));
  assert.deepEqual(await refusal(stream, { videos: [VIDEOS.a] }), invalid("videos"));
  assert.deepEqual(await refusal("home", { id: "renamed" }), invalid("id"));
  assert.deepEqual(await refusal("home", { category: "Weather" }), invalid("category"));
  assert.deepEqual(await refusal("home", { number: 0 }), invalid("number"));
  assert.deepEqual(await refusal("home", { folder: VIDEOS.folder, videos: [VIDEOS.a] }), invalid("folder"));
  assert.deepEqual(await refusal("home", { videos: [path.join(VIDEOS.dir, "nope.mp4")] }), invalid("videos.0"));
  assert.equal((await send(t.app, "PATCH", `/api/channels/${stream}`, { category: "Weather", number: 5 }, token)).status, 200);
  assert.deepEqual(await refusal("missing", { name: "x" }), [404, "channel.not_found", undefined]);
});
