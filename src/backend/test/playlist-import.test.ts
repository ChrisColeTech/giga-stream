// The file import (docs/43 sections 3.2 and 7): one multipart request creates the playlist, every channel (disabled) and
// the playlist's sync job; a re-import with nothing new writes nothing and bumps nothing. Nothing touches the network.
import assert from "node:assert/strict";
import test from "node:test";

import { setupPlaylists, uploadFile, uploadParts, entry, playlistOf, M3U } from "./playlist-kit.js";
import { pick, send } from "./test-app.js";

const NAME = "us.m3u";

test("the import needs a signed-in admin, whatever is in the body", async () => {
  const { t } = await setupPlaylists();
  for (const token of [undefined, "not-a-token"]) {
    const answer = await uploadParts(t, token, [{ name: "file", filename: NAME, content: M3U }]);
    assert.deepEqual([answer.status, pick(answer.body, "error.code")], [401, "auth.unauthorized"]);
  }
});

test("one request creates the playlist, all its channels disabled, and its sync job", async () => {
  const { t, token, api, channels, adminChannels, revision, audit } = await setupPlaylists();
  const before = await revision();
  const made = await uploadFile(t, token, NAME, M3U);
  assert.equal(made.status, 201);
  assert.deepEqual(
    ["name", "kind", "fileName", "enabled", "channels", "enabledChannels", "created"].map((f) => pick(made.body, `data.${f}`)),
    [NAME, "file", NAME, true, 2, 0, true],
  );
  assert.deepEqual(pick(made.body, "data.imported"), { created: 2, updated: 0, skipped: 0, refused: 0, refusalExamples: [] });
  assert.equal(await revision(), before + 1, "one bump for the whole import");
  assert.deepEqual(await channels(), [], "every new channel is disabled, so the public list is empty");
  const rows = await adminChannels();
  assert.deepEqual(rows.map((r) => [r.name, r.enabled, r.published, r.source, r.playlistName]), [
    ["ABC", false, false, NAME, NAME], ["ESPN", false, false, NAME, NAME],
  ]);
  assert.ok(rows.every((r) => r.playlistId === 1 && r.status === undefined && r.cachedLogoUrl === undefined));
  const jobs = pick((await api("GET", "/api/admin/jobs")).body, "data.items") as Array<Record<string, unknown>>;
  const job = jobs.find((j) => j.type === "playlist");
  assert.deepEqual([job?.name, job?.schedule, job?.enabled, job?.playlistId, job?.lastRunAt], [`Sync ${NAME}`, "24h", true, 1, undefined]);
  const imported = (await audit()).find((e) => e.action === "playlist.imported");
  assert.deepEqual(pick(imported, "detail"), { created: 2, updated: 0, skipped: 0, refused: 0, kind: "file", source: NAME });
});

test("an optional multipart name wins over the filename, while an unnamed external upload keeps the fallback", async () => {
  const { t, token } = await setupPlaylists();
  const named = await uploadParts(t, token, [
    { name: "name", content: "My Cable" },
    { name: "file", filename: "provider.m3u", content: M3U },
  ]);
  assert.deepEqual([named.status, pick(named.body, "data.name"), pick(named.body, "data.fileName")], [
    201, "My Cable", "provider.m3u",
  ]);
  const fallback = await uploadFile(t, token, "external.m3u", M3U);
  assert.deepEqual([fallback.status, pick(fallback.body, "data.name")], [201, "external.m3u"]);
});

test("a re-import with nothing new is 200, writes nothing, bumps nothing, and keeps a manual enable", async () => {
  const { t, token, api, channels, adminChannels, revision } = await setupPlaylists();
  await uploadFile(t, token, NAME, M3U);
  const rows = await adminChannels();
  const abc = String(rows.find((r) => r.name === "ABC")?.id);
  await api("PATCH", `/api/admin/channels/${abc}`, { enabled: true });
  const settled = await revision();
  const again = await uploadFile(t, token, NAME, M3U);
  assert.equal(again.status, 200);
  assert.deepEqual([pick(again.body, "data.created"), pick(again.body, "data.imported.created"), pick(again.body, "data.imported.updated")], [false, 0, 0]);
  assert.equal(await revision(), settled, "no revision bump");
  assert.deepEqual((await adminChannels()).map((r) => [r.id, r.enabled]), rows.map((r) => [r.id, r.id === abc]), "same ids, the enable survives");
  assert.deepEqual((await channels()).map((c) => c.name), ["ABC"]);
  assert.equal(pick((await api("GET", "/api/admin/playlists")).body, "data.items.length"), 1);
});

test("a re-import with changes updates in place and creates what is new, with one bump", async () => {
  const { t, token, adminChannels, revision } = await setupPlaylists();
  await uploadFile(t, token, NAME, M3U);
  const ids = (await adminChannels()).map((r) => r.id);
  const settled = await revision();
  const next = playlistOf(entry("ABC", "abc-2", 'tvg-id="a" '), entry("ESPN", "espn"), entry("Cartoon", "cartoon"));
  const again = await uploadFile(t, token, NAME, next);
  assert.deepEqual(pick(again.body, "data.imported"), { created: 1, updated: 1, skipped: 0, refused: 0, refusalExamples: [] });
  assert.equal(await revision(), settled + 1);
  const rows = await adminChannels();
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.filter((r) => ids.includes(r.id)).map((r) => r.id).sort(), [...ids].sort(), "updated in place");
  assert.equal(rows.find((r) => r.name === "ABC")?.streamUrl, "https://stream.example/abc-2.m3u8");
  assert.equal(rows.find((r) => r.name === "Cartoon")?.enabled, false);
});

test("two uploads of one file at once leave one playlist: the second is a re-import", async () => {
  const { t, token, api } = await setupPlaylists();
  const [a, b] = await Promise.all([uploadFile(t, token, NAME, M3U), uploadFile(t, token, NAME, M3U)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 201]);
  assert.equal(pick((await api("GET", "/api/admin/playlists")).body, "data.items.length"), 1);
  assert.equal(pick((await api("GET", "/api/admin/channels")).body, "data.items.length"), 2);
});

test("the name is the sanitised file name; a derived clash is suffixed, a new file is its own playlist", async () => {
  const { t, token, api, importUrl } = await setupPlaylists();
  assert.equal(pick(await uploadFile(t, token, "C:\\lists\\Café Liste.M3U", M3U), "body.data.fileName"), "caf-liste.m3u");
  assert.equal(pick(await uploadFile(t, token, "a b  c.m3u", M3U), "body.data.name"), "a-b-c.m3u");
  await api("PATCH", "/api/admin/playlists/1", { name: "us.m3u" });
  await importUrl("https://cdn.example/lists/us.m3u8?token=x", { name: "web" });
  const clash = await uploadFile(t, token, "us.m3u", M3U);
  assert.deepEqual([clash.status, pick(clash.body, "data.name"), pick(clash.body, "data.fileName")], [201, "us.m3u (2)", "us.m3u"]);
  const hls = await uploadFile(t, token, "D:\\x\\Live List.M3U8", M3U);
  assert.deepEqual([hls.status, pick(hls.body, "data.fileName"), pick(hls.body, "data.name")], [201, "live-list.m3u8", "live-list.m3u8"]);
  assert.equal((await uploadFile(t, token, "日本語.m3u", M3U)).status, 201, "non-ASCII folds to hyphens, no special case");
  for (const bad of ["list.txt", "list.m3u9", "", "dir/"]) {
    const refused = await uploadFile(t, token, bad, M3U);
    assert.deepEqual([refused.status, pick(refused.body, "error.code"), pick(refused.body, "error.details.field")], [422, "playlist.invalid", "file"], bad);
  }
});

test("exactly one file and at most one name: unknown or repeated fields and files are 400; so is an oversized file", async () => {
  const { t, token, api } = await setupPlaylists({ config: { PLAYLIST_SYNC_MAX_BYTES: 2048 } });
  const file = { name: "file", filename: NAME, content: M3U };
  const refusals = [
    [file, { ...file, filename: "two.m3u" }], [file, { name: "note", content: "hi" }],
    [file, { name: "name", content: "one" }, { name: "name", content: "two" }],
    [{ ...file, name: "upload" }], [],
    [{ ...file, content: `${M3U}\n${"#".repeat(3000)}` }],
  ];
  for (const parts of refusals) {
    const answer = await uploadParts(t, token, parts);
    assert.deepEqual([answer.status, pick(answer.body, "error.code")], [400, "request.invalid"], JSON.stringify(parts.map((p) => p.name)));
  }
  assert.equal(pick((await api("GET", "/api/admin/playlists")).body, "data.items.length"), 0, "nothing was created");
  const plain = await send(t.app, "POST", "/api/admin/playlists/import", { file: M3U }, token);
  assert.equal(plain.status, 400, "a JSON body is not an upload");
});

test("a multipart typed-name clash is 409 and an invalid typed name is 422", async () => {
  const { t, token } = await setupPlaylists();
  await uploadParts(t, token, [
    { name: "file", filename: "one.m3u", content: M3U }, { name: "name", content: "Cable" },
  ]);
  const clash = await uploadParts(t, token, [
    { name: "name", content: "cable" }, { name: "file", filename: "two.m3u", content: M3U },
  ]);
  assert.deepEqual([clash.status, pick(clash.body, "error.code"), pick(clash.body, "error.details.field")], [
    409, "playlist.taken", "name",
  ]);
  const invalid = await uploadParts(t, token, [
    { name: "name", content: "   " }, { name: "file", filename: "three.m3u", content: M3U },
  ]);
  assert.deepEqual([invalid.status, pick(invalid.body, "error.code")], [422, "playlist.invalid"]);
});
