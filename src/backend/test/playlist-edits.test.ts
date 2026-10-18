// How a re-import treats an admin's edits (docs/26 section 3.10, docs/43 section 3.6): edited fields, the playlist's own
// name, deleting, `enabled`, revert, and that only this playlist's rows are ever matched. The file is the playlist.
import assert from "node:assert/strict";
import test from "node:test";

import { entry, playlistOf, setupPlaylists, uploadFile } from "./playlist-kit.js";
import { pick, send } from "./test-app.js";

const NAME = "list.m3u";
const V1 = playlistOf(entry("ABC News", "abc", 'tvg-id="us-abc" '), entry("ESPN", "espn"), entry("Cartoon", "cartoon"));
const V2 = playlistOf(
  entry("ABC News", "abc-2", 'tvg-id="us-abc" '),
  entry("ESPN", "espn-2").replace("News", "Sports2"),
  entry("Cartoon", "cartoon-2").replace("News", "Kids2"),
);

async function setup() {
  const s = await setupPlaylists();
  await uploadFile(s.t, s.token, NAME, V1);
  const reimport = (text: string, name = NAME) => uploadFile(s.t, s.token, name, text);
  const idOf = async (name: string, playlist = 1): Promise<string> => {
    const found = (await s.adminChannels()).find((c) => c.name === name && c.playlistId === playlist);
    assert.ok(found, name);
    return String(found.id);
  };
  const row = async (id: string) => (await s.adminChannels()).find((c) => c.id === id) ?? {};
  return { ...s, reimport, idOf, row };
}

test("a synced row records the fields a change really altered; a hand-made row records nothing", async () => {
  const { api, idOf, row } = await setup();
  const hand = String(pick((await api("POST", "/api/channels", { name: "Mine", category: "X", streamUrl: "https://h.example/a.m3u8" })).body, "data.id"));
  const espn = await api("PATCH", `/api/channels/${await idOf("ESPN")}`, { name: "ESPN HD", category: "Edited", number: "5" });
  assert.deepEqual(pick(espn.body, "data.editedFields"), ["name", "category", "number"]);
  assert.equal(pick((await api("PATCH", `/api/channels/${await idOf("ABC News")}`, { name: "ABC News" })).body, "data.editedFields"), undefined);
  assert.equal(pick((await api("PATCH", `/api/channels/${hand}`, { name: "Mine 2", category: "Y" })).body, "data.editedFields"), undefined);
  assert.deepEqual((await row(String(pick(espn.body, "data.id")))).editedFields, ["name", "category", "number"]);
});

test("a re-import keeps what an admin edited, takes the rest, and a rename does not create a duplicate", async () => {
  const { api, reimport, idOf, adminChannels } = await setup();
  const abc = await idOf("ABC News");
  const espn = await idOf("ESPN");
  await api("PATCH", `/api/channels/${abc}`, { streamUrl: "https://mine.example/abc.m3u8" });
  await api("PATCH", `/api/channels/${espn}`, { name: "ESPN HD", category: "Edited" });
  const second = await reimport(V2);
  assert.deepEqual(["created", "updated"].map((f) => pick(second.body, `data.imported.${f}`)), [0, 2], "ESPN's address and Cartoon changed; ABC's only change was its edited address");
  const rows = await adminChannels();
  assert.equal(rows.length, 3, "the renamed row still matches its entry by the playlist's own name");
  const byId = (id: string): Record<string, unknown> => rows.find((r) => r.id === id) ?? {};
  assert.equal(byId(abc).streamUrl, "https://mine.example/abc.m3u8");
  assert.deepEqual([byId(espn).name, byId(espn).category, byId(espn).streamUrl], ["ESPN HD", "Edited", "https://stream.example/espn-2.m3u8"]);
  const cartoon = rows.find((r) => r.name === "Cartoon");
  assert.deepEqual([cartoon?.category, cartoon?.streamUrl], ["Kids2", "https://stream.example/cartoon-2.m3u8"]);
});

test("deleting a synced row is a real delete: a later import adds it again, with a new id", async () => {
  const { api, reimport, idOf, adminChannels } = await setup();
  const cartoon = await idOf("Cartoon");
  assert.equal((await api("DELETE", `/api/channels/${cartoon}`)).status, 200);
  assert.deepEqual((await adminChannels()).map((c) => c.name).sort(), ["ABC News", "ESPN"]);
  assert.equal(pick((await reimport(V1)).body, "data.imported.created"), 1);
  const back = (await adminChannels()).find((c) => c.name === "Cartoon");
  assert.ok(back && back.id !== cartoon);
});

test("a disabled synced row stays disabled through a re-import and is still updated; the public reads leave it out", async () => {
  const { t, api, reimport, idOf, channels, adminChannels } = await setup();
  for (const name of ["ABC News", "ESPN", "Cartoon"]) await api("PATCH", `/api/channels/${await idOf(name)}`, { enabled: true });
  const espn = await idOf("ESPN");
  const off = await api("PATCH", `/api/channels/${espn}`, { enabled: false });
  assert.deepEqual([pick(off.body, "data.enabled"), pick(off.body, "data.editedFields")], [false, undefined], "enabled is not an edit");
  assert.deepEqual((await channels()).map((c) => c.name).sort(), ["ABC News", "Cartoon"]);
  assert.equal((await send(t.app, "GET", `/api/channels/${espn}`)).status, 404);
  assert.equal(pick((await reimport(V2)).body, "data.imported.updated"), 3);
  const row = (await adminChannels()).find((c) => c.id === espn);
  assert.deepEqual([row?.enabled, row?.streamUrl, row?.category], [false, "https://stream.example/espn-2.m3u8", "Sports2"]);
  assert.equal((await channels()).length, 2);
});

test("revert forgets the edits of a synced row, so the next import supplies its values; hand-made rows cannot revert", async () => {
  const { t, api, reimport, idOf, row } = await setup();
  const espn = await idOf("ESPN");
  const hand = String(pick((await api("POST", "/api/channels", { name: "Mine", category: "X", streamUrl: "https://h.example/a.m3u8" })).body, "data.id"));
  await api("PATCH", `/api/channels/${espn}`, { category: "Edited" });
  assert.equal((await send(t.app, "POST", `/api/channels/${espn}/revert`)).status, 401);
  const reverted = await api("POST", `/api/channels/${espn}/revert`);
  assert.deepEqual([reverted.status, pick(reverted.body, "data.editedFields")], [200, undefined]);
  await reimport(V2);
  assert.equal((await row(espn)).category, "Sports2");
  const refused = await api("POST", `/api/channels/${hand}/revert`);
  assert.deepEqual([refused.status, pick(refused.body, "error.code"), pick(refused.body, "error.details.field")], [422, "channel.invalid", "playlistId"]);
  assert.equal((await api("POST", "/api/channels/missing/revert")).status, 404);
});

test("only this playlist's rows are matched: another playlist's channels and a hand-made twin are left alone", async () => {
  const { t, token, api, reimport, adminChannels } = await setup();
  await uploadFile(t, token, "other.m3u", V1);
  const hand = await api("POST", "/api/channels", { name: "ESPN", category: "X", streamUrl: "https://h.example/espn.m3u8" });
  assert.equal(hand.status, 201);
  const before = await adminChannels();
  const out = await reimport(V2);
  assert.deepEqual(["created", "updated"].map((f) => pick(out.body, `data.imported.${f}`)), [0, 3]);
  const after = await adminChannels();
  const same = (id: unknown) => JSON.stringify(after.find((r) => r.id === id)) === JSON.stringify(before.find((r) => r.id === id));
  const untouched = before.filter((r) => r.playlistId !== 1).map((r) => r.id);
  assert.equal(untouched.length, 4, "the other playlist's three and the hand-made one");
  assert.ok(untouched.every(same), "none of them changed");
  assert.equal(after.length, before.length, "and nothing was duplicated");
});
