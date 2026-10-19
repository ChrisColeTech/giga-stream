// Playlists after they exist (docs/43 sections 3.1 and 3.2): the views, rename, enable, rotating a web address, and the
// precedence of the three `enabled` switches. The playlist reads show the address; no audit entry repeats it. No network.
import assert from "node:assert/strict";
import test from "node:test";

import { ONE, TWO, M3U, setupPlaylists, uploadFile } from "./playlist-kit.js";
import { pick, send } from "./test-app.js";

test("every route needs a signed-in admin: 401 without a token", async () => {
  const { t } = await setupPlaylists();
  for (const [method, url, body] of [
    ["GET", "/api/admin/playlists", undefined], ["GET", "/api/admin/playlists/1", undefined],
    ["PATCH", "/api/admin/playlists/1", { enabled: false }], ["DELETE", "/api/admin/playlists/1", undefined],
  ] as const) {
    for (const token of [undefined, "not-a-token"]) {
      const answer = await send(t.app, method, url, body, token);
      assert.deepEqual([answer.status, pick(answer.body, "error.code")], [401, "auth.unauthorized"], `${method} ${url}`);
    }
  }
});

test("the list and a read are the same view: counts, host or file name, the job's last run; the address in full for a web playlist", async () => {
  const { t, token, api, importUrl } = await setupPlaylists();
  await importUrl(ONE);
  await uploadFile(t, token, "mine.m3u", M3U);
  const list = (await api("GET", "/api/admin/playlists")).body;
  assert.deepEqual(pick(list, "data.items.0"), {
    id: 1, name: "us", kind: "url", url: ONE, host: "cdn.example", enabled: true,
    channels: 2, enabledChannels: 0, online: 0, offline: 0,
  });
  assert.deepEqual(pick(list, "data.items.1"), {
    id: 2, name: "mine.m3u", kind: "file", fileName: "mine.m3u", enabled: true, channels: 2, enabledChannels: 0, online: 0, offline: 0,
  });
  assert.deepEqual((await api("GET", "/api/admin/playlists/2")).body, { ok: true, data: pick(list, "data.items.1") });
  const missing = await api("GET", "/api/admin/playlists/99");
  assert.deepEqual([missing.status, pick(missing.body, "error.code")], [404, "playlist.not_found"]);
});

test("a patch renames, disables, or - for a web playlist - replaces the address; a clash is 409, a file has no address", async () => {
  const { t, token, api, feed, importUrl, audit } = await setupPlaylists();
  await importUrl(ONE);
  await uploadFile(t, token, "mine.m3u", M3U);
  const named = await api("PATCH", "/api/admin/playlists/1", { name: "Cable", enabled: false });
  assert.deepEqual([pick(named.body, "data.name"), pick(named.body, "data.enabled")], ["Cable", false]);
  assert.equal(pick(await api("PATCH", "/api/admin/playlists/1", { name: "CABLE" }), "body.data.name"), "CABLE", "its own name, another case");
  const clash = await api("PATCH", "/api/admin/playlists/2", { name: "cable" });
  assert.deepEqual([clash.status, pick(clash.body, "error.code")], [409, "playlist.taken"]);
  const moved = await api("PATCH", "/api/admin/playlists/1", { url: TWO });
  assert.deepEqual([pick(moved.body, "data.host"), pick(moved.body, "data.channels")], ["other.example", 2], "its channels stay");
  assert.equal(pick(await api("PATCH", "/api/admin/playlists/1", { url: "ftp://x.example/a.m3u" }), "body.error.details.field"), "url");
  const held = await api("PATCH", "/api/admin/playlists/1", { url: ONE });
  assert.equal(held.status, 200, "an address is free again once it is rotated away");
  await importUrl(TWO, { name: "second" });
  const taken = await api("PATCH", "/api/admin/playlists/1", { url: TWO });
  assert.deepEqual([taken.status, pick(taken.body, "error.code")], [409, "playlist.taken"]);
  const file = await api("PATCH", "/api/admin/playlists/2", { url: ONE });
  assert.deepEqual([file.status, pick(file.body, "error.code"), pick(file.body, "error.details.field")], [422, "playlist.invalid", "url"]);
  assert.equal((await api("PATCH", "/api/admin/playlists/99", { name: "x" })).status, 404);
  assert.equal((await api("PATCH", "/api/admin/playlists/1", { kind: "file" })).status, 422);
  const text = JSON.stringify(await audit());
  assert.equal(["SECRET-VALUE", "ANOTHER-SECRET", "token=", "key="].some((s) => text.includes(s)), false);
  assert.equal(pick((await api("GET", "/api/admin/playlists/1")).body, "data.url"), ONE, "the read shows the rotated address");
  assert.equal(feed.asked.length, 2, "a patch fetches nothing");
});

test("a playlist's enabled switch decides what the public reads show, and it takes a revision", async () => {
  const { t, token, api, channels, revision } = await setupPlaylists();
  await uploadFile(t, token, "mine.m3u", M3U);
  const rows = (await api("GET", "/api/admin/channels")).body;
  const ids = (pick(rows, "data.items") as Array<Record<string, unknown>>).map((r) => String(r.id));
  for (const id of ids) await api("PATCH", `/api/admin/channels/${id}`, { enabled: true });
  assert.equal((await channels()).length, 2);
  const before = await revision();
  await api("PATCH", "/api/admin/playlists/1", { enabled: false });
  assert.equal(await revision(), before + 1, "a playlist's enabled change is a public change");
  assert.deepEqual(await channels(), [], "the public list leaves out a disabled playlist's channels");
  assert.equal((await send(t.app, "GET", `/api/channels/${ids[0]}`)).status, 404);
  const admin = (pick((await api("GET", "/api/admin/channels")).body, "data.items") as Array<Record<string, unknown>>);
  assert.deepEqual(admin.map((r) => [r.enabled, r.published]), [[true, false], [true, false]]);
  await api("PATCH", "/api/admin/playlists/1", { name: "renamed" });
  assert.equal(await revision(), before + 1, "a rename changes nothing a reader sees");
  await api("PATCH", "/api/admin/playlists/1", { enabled: true });
  assert.equal((await channels()).length, 2);
  assert.equal(await revision(), before + 2);
});
