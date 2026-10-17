// How the playlist sync treats an admin's edits (docs/26 section 3.10): edited fields, the playlist's own name,
// prune, deleting, `enabled` and revert. The playlist is a string the test changes; nothing touches the network.
import assert from "node:assert/strict";
import test from "node:test";

import { itemOf, itemsOf } from "./live-channel-kit.js";
import { makeApp, pick, send, signIn } from "./test-app.js";

const URL_ONE = "https://cdn.example/list.m3u8";
const entry = (name: string, group: string, address: string, tvg = "") =>
  `#EXTINF:-1 ${tvg === "" ? "" : `tvg-id="${tvg}" `}group-title="${group}",${name}\nhttps://stream.example/${address}.m3u8`;
const playlist = (...entries: string[]) => ["#EXTM3U", ...entries].join("\n");

const V1 = playlist(entry("ABC News", "News", "abc", "us-abc"), entry("ESPN", "Sports", "espn"), entry("Cartoon", "Kids", "cartoon"));
const V2 = playlist(
  entry("ABC News", "News", "abc-2", "us-abc"),
  entry("ESPN", "Sports2", "espn-2"),
  entry("Cartoon", "Kids2", "cartoon-2"),
);
const ONLY_ABC = playlist(entry("ABC News", "News", "abc", "us-abc"));

async function setup() {
  let text = V1;
  const fetchImpl: typeof fetch = async (input) =>
    String(input) === URL_ONE ? new Response(text) : new Response("missing", { status: 404 });
  const t = await makeApp({ fetch: fetchImpl, config: { PLAYLIST_URLS: [URL_ONE] } });
  const token = (await signIn(t.app)).access;
  const run = (body: Record<string, unknown> = {}) => send(t.app, "POST", "/api/playlist-sync", body, token);
  const channels = async () => itemsOf((await send(t.app, "GET", "/api/channels")).body);
  const byName = async (name: string) => {
    const found = (await channels()).find((c) => c.name === name);
    assert.ok(found, name);
    return String(found.id);
  };
  return { t, token, run, channels, byName, playlist: (next: string) => void (text = next) };
}

test("a synced row records the fields a change really altered; a hand-made row records nothing", async () => {
  const { t, token, run, byName } = await setup();
  await run();
  const hand = String(pick((await send(t.app, "POST", "/api/channels", { name: "Mine", category: "X", streamUrl: "https://h.example/a.m3u8" }, token)).body, "data.id"));
  const espn = await send(t.app, "PATCH", `/api/channels/${await byName("ESPN")}`, { name: "ESPN HD", category: "Edited", number: "5" }, token);
  assert.deepEqual(pick(espn.body, "data.editedFields"), ["name", "category", "number"]);
  const same = await send(t.app, "PATCH", `/api/channels/${await byName("ABC News")}`, { name: "ABC News" }, token);
  assert.equal(pick(same.body, "data.editedFields"), undefined, "a value that did not change is not an edit");
  assert.equal(pick((await send(t.app, "PATCH", `/api/channels/${hand}`, { name: "Mine 2", category: "Y" }, token)).body, "data.editedFields"), undefined);
  const admin = await send(t.app, "GET", "/api/admin-channels", undefined, token);
  assert.deepEqual(itemOf(admin.body, String(pick(espn.body, "data.id"))).editedFields, ["name", "category", "number"]);
});

test("a sync keeps what an admin edited, takes the rest, and a rename does not create a duplicate", async () => {
  const { t, token, run, channels, byName, playlist: setPlaylist } = await setup();
  await run();
  const abc = await byName("ABC News");
  const espn = await byName("ESPN");
  await send(t.app, "PATCH", `/api/channels/${abc}`, { streamUrl: "https://mine.example/abc.m3u8" }, token);
  await send(t.app, "PATCH", `/api/channels/${espn}`, { name: "ESPN HD", category: "Edited" }, token);
  setPlaylist(V2);
  const second = await run();
  assert.deepEqual(
    ["created", "updated", "kept"].map((f) => pick(second.body, `data.${f}`)),
    [0, 2, 0],
    "ESPN (its address) and Cartoon changed; ABC's only change was its edited address",
  );
  const rows = await channels();
  assert.equal(rows.length, 3, "the renamed row still matches its entry by the playlist's name");
  const row = (id: string): Record<string, unknown> => rows.find((r) => r.id === id) ?? {};
  assert.equal(row(abc).streamUrl, "https://mine.example/abc.m3u8");
  assert.deepEqual([row(espn).name, row(espn).category, row(espn).streamUrl], ["ESPN HD", "Edited", "https://stream.example/espn-2.m3u8"]);
  const cartoon = rows.find((r) => r.name === "Cartoon");
  assert.deepEqual([cartoon?.category, cartoon?.streamUrl], ["Kids2", "https://stream.example/cartoon-2.m3u8"]);
});

test("prune never deletes an edited row: it is kept, counted, and audited", async () => {
  const { t, token, run, channels, byName, playlist: setPlaylist } = await setup();
  await run();
  await send(t.app, "PATCH", `/api/channels/${await byName("ESPN")}`, { category: "Mine" }, token);
  setPlaylist(ONLY_ABC);
  const dry = await run({ dryRun: true, prune: true });
  assert.deepEqual(["removed", "kept"].map((f) => pick(dry.body, `data.${f}`)), [1, 1]);
  assert.equal((await channels()).length, 3, "a dry run deletes nothing");
  const real = await run({ prune: true });
  assert.deepEqual(["removed", "kept"].map((f) => pick(real.body, `data.${f}`)), [1, 1]);
  assert.deepEqual((await channels()).map((c) => c.name).sort(), ["ABC News", "ESPN"]);
  const status = await send(t.app, "GET", "/api/playlist-sync", undefined, token);
  assert.deepEqual(["removed", "kept"].map((f) => pick(status.body, `data.counts.${f}`)), [1, 1]);
  const audit = pick((await send(t.app, "GET", "/api/audit?limit=5", undefined, token)).body, "data.items.0.detail.kept");
  assert.equal(audit, 1);
});

test("deleting a synced row is a real delete: a later sync adds it again, with a new id", async () => {
  const { t, token, run, channels, byName } = await setup();
  await run();
  const cartoon = await byName("Cartoon");
  assert.equal((await send(t.app, "DELETE", `/api/channels/${cartoon}`, undefined, token)).status, 200);
  assert.deepEqual((await channels()).map((c) => c.name).sort(), ["ABC News", "ESPN"]);
  const again = await run();
  assert.equal(pick(again.body, "data.created"), 1);
  const back = (await channels()).find((c) => c.name === "Cartoon");
  assert.ok(back && back.id !== cartoon);
});

test("a disabled synced row stays disabled through a sync and is still updated; the public reads leave it out", async () => {
  const { t, token, run, channels, byName, playlist: setPlaylist } = await setup();
  await run();
  const espn = await byName("ESPN");
  const off = await send(t.app, "PATCH", `/api/channels/${espn}`, { enabled: false }, token);
  assert.deepEqual([pick(off.body, "data.enabled"), pick(off.body, "data.editedFields")], [false, undefined], "enabled is not an edit");
  assert.deepEqual((await channels()).map((c) => c.name).sort(), ["ABC News", "Cartoon"]);
  assert.equal((await send(t.app, "GET", `/api/channels/${espn}`)).status, 404);
  setPlaylist(V2);
  const second = await run();
  assert.equal(pick(second.body, "data.updated"), 3, "the disabled row is updated like the others");
  const admin = itemsOf((await send(t.app, "GET", "/api/admin-channels", undefined, token)).body);
  const row = admin.find((c) => c.id === espn);
  assert.deepEqual([row?.enabled, row?.streamUrl, row?.category], [false, "https://stream.example/espn-2.m3u8", "Sports2"]);
  assert.equal((await channels()).length, 2, "and it is still left out of the public list");
});

test("revert forgets the edits of a synced row, so the next sync supplies its values; hand-made rows cannot revert", async () => {
  const { t, token, run, channels, byName, playlist: setPlaylist } = await setup();
  await run();
  const espn = await byName("ESPN");
  const hand = String(pick((await send(t.app, "POST", "/api/channels", { name: "Mine", category: "X", streamUrl: "https://h.example/a.m3u8" }, token)).body, "data.id"));
  await send(t.app, "PATCH", `/api/channels/${espn}`, { category: "Edited" }, token);
  assert.equal((await send(t.app, "POST", `/api/channels/${espn}/revert`)).status, 401);
  const reverted = await send(t.app, "POST", `/api/channels/${espn}/revert`, undefined, token);
  assert.deepEqual([reverted.status, pick(reverted.body, "data.editedFields")], [200, undefined]);
  setPlaylist(V2);
  await run();
  assert.equal((await channels()).find((c) => c.id === espn)?.category, "Sports2");
  const refused = await send(t.app, "POST", `/api/channels/${hand}/revert`, undefined, token);
  assert.deepEqual([refused.status, pick(refused.body, "error.code"), pick(refused.body, "error.details.field")], [422, "channel.invalid", "source"]);
  assert.equal((await send(t.app, "POST", "/api/channels/missing/revert", undefined, token)).status, 404);
  const actions = (pick((await send(t.app, "GET", "/api/audit?limit=50", undefined, token)).body, "data.items") as Array<Record<string, unknown>>).map((e) => e.action);
  assert.ok(actions.includes("channel.reverted"));
});

test("a run answers kept beside the older counts", async () => {
  const { run } = await setup();
  const first = await run();
  assert.deepEqual(
    ["created", "updated", "skipped", "refused", "removed", "kept"].map((f) => pick(first.body, `data.${f}`)),
    [3, 0, 0, 0, 0, 0],
  );
});
