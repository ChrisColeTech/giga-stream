// `PUT /api/channels/:channelId/status` (docs/36 section 8.1): a hand-set verdict on a stream channel, written to the
// sync-owned `status` and `checked_at` only. Admin only, stream channels only, no revision, audited.
import assert from "node:assert/strict";
import test from "node:test";

import { itemOf, liveBody, streamBody } from "./live-channel-kit.js";
import { makeApp, pick, send, signIn } from "./test-app.js";

async function fixture() {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  const id = String(pick((await send(t.app, "POST", "/api/channels", streamBody(), token)).body, "data.id"));
  return { t, token, id };
}

const admin = async (t: Awaited<ReturnType<typeof fixture>>["t"], token: string, id: string) =>
  itemOf((await send(t.app, "GET", "/api/admin-channels", undefined, token)).body, id);

test("a verdict needs a signed-in admin", async () => {
  const { t, token, id } = await fixture();
  const none = await send(t.app, "PUT", `/api/channels/${id}/status`, { status: "offline" });
  assert.equal(none.status, 401);
  assert.equal((await admin(t, token, id)).status, undefined, "nothing was written");
});

test("a verdict writes status and checkedAt only: no revision, no edited field, the row otherwise whole", async () => {
  const { t, token, id } = await fixture();
  const before = await admin(t, token, id);
  const revisionBefore = pick((await send(t.app, "GET", "/api/channels")).body, "data.revision");
  t.clock.advance(5_000);
  const offline = await send(t.app, "PUT", `/api/channels/${id}/status`, { status: "offline" }, token);
  assert.equal(offline.status, 200);
  assert.deepEqual([pick(offline.body, "data.status"), pick(offline.body, "data.checkedAt")], ["offline", t.clock.now()]);
  const after = await admin(t, token, id);
  assert.deepEqual({ ...after, status: undefined, checkedAt: undefined }, { ...before, status: undefined, checkedAt: undefined });
  assert.equal(after.editedFields, undefined, "a verdict is not an edit");
  assert.equal(pick((await send(t.app, "GET", "/api/channels")).body, "data.revision"), revisionBefore, "no revision");
  const online = await send(t.app, "PUT", `/api/channels/${id}/status`, { status: "online" }, token);
  assert.equal(pick(online.body, "data.status"), "online");
  assert.equal((await admin(t, token, id)).status, "online");
});

test("a live channel is refused, a missing one is not found, a bad body is invalid", async () => {
  const { t, token, id } = await fixture();
  await send(t.app, "POST", "/api/channels", liveBody(), token);
  const notStream = await send(t.app, "PUT", "/api/channels/home/status", { status: "offline" }, token);
  assert.deepEqual([notStream.status, pick(notStream.body, "error.code")], [422, "channel.not_stream"]);
  const missing = await send(t.app, "PUT", "/api/channels/nope/status", { status: "offline" }, token);
  assert.deepEqual([missing.status, pick(missing.body, "error.code")], [404, "channel.not_found"]);
  for (const body of [{ status: "maybe" }, {}, { status: "online", extra: 1 }]) {
    const bad = await send(t.app, "PUT", `/api/channels/${id}/status`, body, token);
    assert.deepEqual([bad.status, pick(bad.body, "error.code")], [422, "channel.invalid"], JSON.stringify(body));
  }
  assert.equal((await admin(t, token, id)).status, undefined, "a refused verdict wrote nothing");
});

test("a verdict is audited with the old and the new word", async () => {
  const { t, token, id } = await fixture();
  await send(t.app, "PUT", `/api/channels/${id}/status`, { status: "offline" }, token);
  await send(t.app, "PUT", `/api/channels/${id}/status`, { status: "online" }, token);
  const items = pick((await send(t.app, "GET", "/api/audit", undefined, token)).body, "data.items") as Array<
    Record<string, unknown>
  >;
  const set = items.filter((entry) => entry.action === "channel.status.set");
  assert.equal(set.length, 2);
  assert.equal(set[0]?.subject, id);
  assert.deepEqual([pick(set[0], "detail.from"), pick(set[0], "detail.to")], ["offline", "online"]);
  assert.deepEqual([pick(set[1], "detail.from"), pick(set[1], "detail.to")], [null, "offline"]);
});
