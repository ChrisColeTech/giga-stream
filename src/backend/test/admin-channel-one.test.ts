// `GET /api/admin/channels/:channelId` (docs/36 section 8.2): one row, the list's own admin view, signed in, no-store.
import assert from "node:assert/strict";
import test from "node:test";

import { itemOf, liveBody, streamBody } from "./live-channel-kit.js";
import { makeApp, pick, send, signIn } from "./test-app.js";

test("one channel is the list's own row; signed in only, no-store; a missing one is 404", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  const id = String(pick((await send(t.app, "POST", "/api/admin/channels", streamBody(), token)).body, "data.id"));
  await send(t.app, "POST", "/api/admin/channels", liveBody(), token);
  const list = await send(t.app, "GET", "/api/admin/channels", undefined, token);

  for (const want of [id, "home"]) {
    const one = await send(t.app, "GET", `/api/admin/channels/${want}`, undefined, token);
    assert.equal(one.status, 200);
    assert.equal(one.headers["cache-control"], "no-store");
    assert.deepEqual(pick(one.body, "data"), itemOf(list.body, want), `${want} is the list's row`);
  }

  const anonymous = await send(t.app, "GET", `/api/admin/channels/${id}`);
  assert.equal(anonymous.status, 401);
  const missing = await send(t.app, "GET", "/api/admin/channels/nope", undefined, token);
  assert.deepEqual([missing.status, pick(missing.body, "error.code")], [404, "channel.not_found"]);
  assert.equal(missing.headers["cache-control"], "no-store");
});
