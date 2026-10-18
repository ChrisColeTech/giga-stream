// Playlists are records (docs/26 section 3.11): name, address, `Enabled`. The address is never echoed or audited
// beyond its host; deleting a playlist keeps its channels as hand-made rows. Nothing touches the network.
import assert from "node:assert/strict";
import test from "node:test";

import { itemOf, itemsOf } from "./live-channel-kit.js";
import { makeApp, pick, send, signIn } from "./test-app.js";

const SECRET = "https://cdn.example/list.m3u8?token=SECRET-VALUE";
const OTHER = "https://other.example/all.m3u8?key=ANOTHER-SECRET";
const M3U = [
  "#EXTM3U",
  '#EXTINF:-1 tvg-id="a" group-title="News",ABC\nhttps://stream.example/abc.m3u8',
  '#EXTINF:-1 group-title="Sports",ESPN\nhttps://stream.example/espn.m3u8',
].join("\n");

async function setup(config: Record<string, unknown> = {}) {
  const asked: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    // Only the playlists count: the logo index is fetched through here too.
    if (String(input).includes("m3u8")) asked.push(String(input));
    return String(input).includes("m3u8") ? new Response(M3U) : new Response("missing", { status: 404 });
  };
  const t = await makeApp({ fetch: fetchImpl, config });
  const token = (await signIn(t.app)).access;
  const add = (address: unknown, extra: Record<string, unknown> = {}) =>
    send(t.app, "POST", "/api/playlists", { address, ...extra }, token);
  const leak = async (): Promise<string> => {
    const reads = [
      await send(t.app, "GET", "/api/playlists", undefined, token),
      await send(t.app, "GET", "/api/audit?limit=100", undefined, token),
      await send(t.app, "GET", "/api/playlist-sync", undefined, token),
      await send(t.app, "GET", "/api/jobs", undefined, token),
    ];
    return JSON.stringify(reads.map((r) => r.body));
  };
  return { t, token, add, asked, leak };
}

test("every route needs a signed-in admin: 401 without a token", async () => {
  const { t } = await setup();
  for (const [method, url, body] of [
    ["GET", "/api/playlists", undefined], ["POST", "/api/playlists", { address: SECRET }],
    ["GET", "/api/playlists/1", undefined], ["PATCH", "/api/playlists/1", { enabled: false }],
    ["DELETE", "/api/playlists/1", undefined],
  ] as const) {
    for (const token of [undefined, "not-a-token"]) {
      const answer = await send(t.app, method, url, body, token);
      assert.deepEqual([answer.status, pick(answer.body, "error.code")], [401, "auth.unauthorized"], `${method} ${url}`);
    }
  }
});

test("a playlist is created, listed and read as host and mask; its address is never echoed, logged or audited", async () => {
  const { t, token, add, leak } = await setup();
  const made = await add(SECRET, { name: "Cable" });
  assert.deepEqual(
    [made.status, pick(made.body, "data")],
    [201, { id: 1, name: "Cable", host: "cdn.example", masked: "https://cdn.example/…", enabled: true, channels: 0 }],
  );
  assert.equal(pick((await add(OTHER)).body, "data.name"), "other.example", "the name defaults to the host");
  assert.deepEqual(itemsOf((await send(t.app, "GET", "/api/playlists", undefined, token)).body).map((p) => p.id), [1, 2]);
  assert.equal(pick((await send(t.app, "GET", "/api/playlists/2", undefined, token)).body, "data.host"), "other.example");
  const body = await leak();
  for (const secret of ["SECRET-VALUE", "ANOTHER-SECRET", "token=", "key=", "m3u8"]) assert.equal(body.includes(secret), false, secret);
  const actions = (pick((await send(t.app, "GET", "/api/audit?limit=5", undefined, token)).body, "data.items") as Array<Record<string, unknown>>);
  assert.deepEqual(actions.slice(0, 2).map((e) => [e.action, pick(e, "detail.host")]), [["playlist.created", "other.example"], ["playlist.created", "cdn.example"]]);
});

test("an address must be https, without credentials, and listed once; a bad id is 404", async () => {
  const { t, token, add } = await setup();
  for (const address of ["http://cdn.example/a.m3u8", "ftp://x/a", "not a url", "https://user:pw@cdn.example/a.m3u8"]) {
    const refused = await add(address);
    assert.deepEqual([refused.status, pick(refused.body, "error.code"), pick(refused.body, "error.details.field")], [422, "playlist.invalid", "address"], address);
  }
  assert.equal((await add(SECRET)).status, 201);
  assert.equal(pick((await add(SECRET)).body, "error.details.field"), "address", "listed once");
  assert.equal((await send(t.app, "POST", "/api/playlists", { address: SECRET, colour: "red" }, token)).status, 422);
  const missing = await send(t.app, "GET", "/api/playlists/99", undefined, token);
  assert.deepEqual([missing.status, pick(missing.body, "error.code")], [404, "playlist.not_found"]);
});

test("a patch renames, disables or replaces the address; the new address is not echoed and its host is audited", async () => {
  const { t, token, add, leak } = await setup();
  await add(SECRET);
  const patch = (body: unknown) => send(t.app, "PATCH", "/api/playlists/1", body, token);
  const named = await patch({ name: "Cable", enabled: false });
  assert.deepEqual([pick(named.body, "data.name"), pick(named.body, "data.enabled")], ["Cable", false]);
  const moved = await patch({ address: OTHER });
  assert.deepEqual([pick(moved.body, "data.host"), pick(moved.body, "data.masked")], ["other.example", "https://other.example/…"]);
  const refused = await patch({ address: "http://x.example/a.m3u8" });
  assert.deepEqual([refused.status, pick(refused.body, "error.details.field")], [422, "address"]);
  assert.equal((await send(t.app, "PATCH", "/api/playlists/99", { name: "x" }, token)).status, 404);
  const body = await leak();
  assert.equal(body.includes("ANOTHER-SECRET") || body.includes("SECRET-VALUE"), false);
  const audit = pick((await send(t.app, "GET", "/api/audit?limit=5", undefined, token)).body, "data.items.0") as Record<string, unknown>;
  assert.deepEqual([audit.action, pick(audit, "detail.host")], ["playlist.updated", "other.example"]);
});

test("a disabled playlist is skipped by the sync; only an enabled one is fetched", async () => {
  const { t, token, add, asked } = await setup();
  await add(SECRET);
  await add(OTHER);
  await send(t.app, "PATCH", "/api/playlists/1", { enabled: false }, token);
  const run = await send(t.app, "POST", "/api/playlist-sync", {}, token);
  assert.equal(pick(run.body, "data.created"), 2);
  assert.deepEqual(asked, [OTHER], "only the enabled playlist's address was fetched");
  const list = itemsOf((await send(t.app, "GET", "/api/playlists", undefined, token)).body);
  assert.deepEqual(list.map((p) => [p.id, p.channels, p.lastOutcome ?? null]), [[1, 0, null], [2, 2, "ok"]]);
});

test("deleting a playlist keeps its channels as hand-made rows that no sync touches again, and removes its jobs", async () => {
  const { t, token, add, asked } = await setup();
  await add(SECRET);
  const job = await send(t.app, "POST", "/api/jobs", { type: "playlist", name: "Sync it", config: { playlistId: 1 } }, token);
  assert.equal(job.status, 201);
  await send(t.app, "POST", "/api/playlist-sync", {}, token);
  const hand = await send(t.app, "POST", "/api/channels", { name: "Mine", category: "X", streamUrl: "https://h.example/a.m3u8" }, token);
  assert.equal(pick((await send(t.app, "GET", "/api/playlists/1", undefined, token)).body, "data.channels"), 2);
  const revision = pick((await send(t.app, "GET", "/api/channels")).body, "data.revision");

  const gone = await send(t.app, "DELETE", "/api/playlists/1", undefined, token);
  assert.deepEqual([gone.status, gone.body], [200, { ok: true, data: { id: 1, released: 2 } }]);
  assert.equal(Number(pick((await send(t.app, "GET", "/api/channels")).body, "data.revision")), Number(revision) + 1);
  const rows = itemsOf((await send(t.app, "GET", "/api/channels")).body);
  assert.deepEqual(rows.map((r) => r.name).sort(), ["ABC", "ESPN", "Mine"], "the channels stay");
  assert.equal(rows.some((r) => r.source !== undefined), false, "and lose their source");
  assert.equal(String(pick(hand.body, "data.id")).startsWith("ch_"), true);
  const jobs = itemsOf((await send(t.app, "GET", "/api/jobs", undefined, token)).body);
  assert.deepEqual(jobs.filter((j) => j.type === "playlist"), [], "its jobs went with it; the catalog jobs stay");
  assert.equal(jobs.length, 1);
  assert.equal((await send(t.app, "GET", "/api/playlists/1", undefined, token)).status, 404);

  // The same address listed again makes new rows: the released ones are hand-made now.
  await add(SECRET);
  const again = await send(t.app, "POST", "/api/playlist-sync", {}, token);
  assert.equal(pick(again.body, "data.created"), 2);
  assert.equal(itemsOf((await send(t.app, "GET", "/api/channels")).body).length, 5);
  assert.equal(asked.length, 2);
  assert.equal(itemOf((await send(t.app, "GET", "/api/admin-channels", undefined, token)).body, String(rows[0]?.id)).source, undefined);
});
