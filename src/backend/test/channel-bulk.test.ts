// `PATCH /api/channels` (docs/43 section 3.3): one switch for up to 5,000 ids, stream rows only, one transaction, one
// revision, one audit entry; `{ changed, unchanged, skipped }`; its own body limit.
import assert from "node:assert/strict";
import test from "node:test";

import { CHANNEL_BODY_LIMIT_BYTES, CHANNEL_BULK_MAX, REQUEST_BODY_LIMIT_BYTES } from "../src/constants/limits.js";
import { liveBody } from "./live-channel-kit.js";
import { m3u, m3uEntry, STREAM } from "./sync-kit.js";
import { setupPlaylists, uploadFile } from "./playlist-kit.js";
import { pick } from "./test-app.js";

async function withChannels() {
  const s = await setupPlaylists();
  await uploadFile(s.t, s.token, "list.m3u", m3u(...["a", "b", "c"].map((n) => m3uEntry(n, STREAM("s.example", n)))));
  const live = await s.api("POST", "/api/channels", liveBody());
  const rows = await s.adminChannels();
  const ids = rows.filter((r) => r.kind === "stream").map((r) => String(r.id));
  return { s, ids, liveId: String(pick(live.body, "data.id")) };
}

test("it flips stream rows in one transaction with one revision and one audit entry, and counts the rest", async () => {
  const { s, ids, liveId } = await withChannels();
  const [first, ...others] = ids;
  await s.api("PATCH", `/api/channels/${first}`, { enabled: true });
  const before = await s.revision();
  const answer = await s.api("PATCH", "/api/channels", { enabled: true, ids: [...ids, liveId, "no-such-channel", String(first)] });
  assert.deepEqual([answer.status, pick(answer.body, "data")], [200, { changed: 2, unchanged: 1, skipped: 2 }]);
  assert.equal(await s.revision(), before + 1, "one revision for the whole call");
  const rows = await s.adminChannels();
  assert.deepEqual(rows.filter((r) => r.kind === "stream").map((r) => r.enabled), [true, true, true]);
  assert.equal(rows.find((r) => r.id === liveId)?.enabled, true, "the live row was left alone");
  assert.equal(new Set(rows.filter((r) => others.includes(String(r.id))).map((r) => r.revision)).size, 1, "the same row revision");
  const entries = (await s.audit()).filter((e) => e.action === "channel.enabled_bulk");
  assert.equal(entries.length, 1);
  assert.deepEqual([pick(entries[0], "detail.enabled"), pick(entries[0], "detail.changed")], [true, 2]);

  const off = await s.api("PATCH", "/api/channels", { enabled: false, ids });
  assert.deepEqual(pick(off.body, "data"), { changed: 3, unchanged: 0, skipped: 0 });
  assert.deepEqual((await s.channels()).map((c) => c.kind), ["live"], "disabled rows leave the public list");
});

test("a call that flips nothing takes no revision and writes no audit entry", async () => {
  const { s, ids } = await withChannels();
  const before = await s.revision();
  const answer = await s.api("PATCH", "/api/channels", { enabled: false, ids });
  assert.deepEqual(pick(answer.body, "data"), { changed: 0, unchanged: 3, skipped: 0 });
  assert.equal(await s.revision(), before);
  assert.equal((await s.audit()).filter((e) => e.action === "channel.enabled_bulk").length, 0);
});

test("1 to 5,000 ids: none, 5,001, a non-string, a missing switch and an extra field are 422 on their field", async () => {
  const { s, ids } = await withChannels();
  const refused = async (body: unknown): Promise<[number, unknown, unknown]> => {
    const a = await s.api("PATCH", "/api/channels", body);
    return [a.status, pick(a.body, "error.code"), pick(a.body, "error.details.field")];
  };
  assert.deepEqual(await refused({ enabled: true, ids: [] }), [422, "channel.invalid", "ids"]);
  assert.deepEqual(await refused({ enabled: true, ids: Array.from({ length: CHANNEL_BULK_MAX + 1 }, (_, i) => `x${i}`) }), [422, "channel.invalid", "ids"]);
  assert.deepEqual(await refused({ enabled: true, ids: [5] }), [422, "channel.invalid", "ids.0"]);
  assert.deepEqual(await refused({ ids }), [422, "channel.invalid", "enabled"]);
  assert.deepEqual(await refused({ enabled: true, ids, name: "x" }), [422, "channel.invalid", "name"]);
  const top = await s.api("PATCH", "/api/channels", { enabled: true, ids: Array.from({ length: CHANNEL_BULK_MAX }, (_, i) => `ch_${"0".repeat(32)}-${i}`) });
  assert.deepEqual([top.status, pick(top.body, "data.skipped")], [200, CHANNEL_BULK_MAX], "5,000 ids fit the body limit");
});

test("it has its own body limit, and needs a session", async () => {
  const { s } = await withChannels();
  const body = (count: number) => JSON.stringify({ enabled: true, ids: Array.from({ length: count }, (_, i) => `${i}`.padStart(80, "x")) });
  const send = (payload: string) => s.t.app.inject({
    method: "PATCH", url: "/api/channels", payload,
    headers: { "content-type": "application/json", authorization: `Bearer ${s.token}` },
  });
  const medium = body(1_000);
  assert.ok(medium.length > REQUEST_BODY_LIMIT_BYTES && medium.length < CHANNEL_BODY_LIMIT_BYTES);
  assert.equal((await send(medium)).statusCode, 200, "more than the app's 64 KiB default is accepted");
  const big = body(CHANNEL_BULK_MAX);
  assert.ok(big.length > CHANNEL_BODY_LIMIT_BYTES);
  const refused = await send(big);
  assert.deepEqual([refused.statusCode, refused.json().error.code], [400, "request.invalid"], "past the route's limit the envelope refuses it");
  const anonymous = await s.t.app.inject({ method: "PATCH", url: "/api/channels", payload: { enabled: true, ids: ["a"] } });
  assert.equal(anonymous.statusCode, 401);
});
