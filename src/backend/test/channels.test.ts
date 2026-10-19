import test from "node:test";
import assert from "node:assert/strict";

import { liveBody } from "./live-channel-kit.js";
import { makeApp, pick, send, signIn } from "./test-app.js";

const news = { name: "News", category: "News", number: "7", streamUrl: "https://live.example/news.m3u8" };

test("health answers role, version, revision, TMDB state and the live channel count in the envelope", async () => {
  const t = await makeApp();
  const answer = await send(t.app, "GET", "/healthz");
  assert.equal(answer.status, 200);
  assert.deepEqual(answer.body, {
    ok: true,
    data: { role: "admin-backend", version: "0.1.0", revision: 0, tmdb: "absent", liveChannels: 0 },
  });
});

test("a new backend lists no channels at revision 0, with no sign-in", async () => {
  const t = await makeApp();
  assert.deepEqual((await send(t.app, "GET", "/api/channels")).body, { ok: true, data: { items: [], revision: 0 } });
});

test("a change needs a signed-in admin: no token and a bad one are auth.unauthorized", async () => {
  const t = await makeApp();
  for (const token of [undefined, "not-a-token"]) {
    const answer = await send(t.app, "POST", "/api/admin/channels", news, token);
    assert.equal(answer.status, 401);
    assert.equal(pick(answer.body, "error.code"), "auth.unauthorized");
  }
  assert.equal(pick((await send(t.app, "GET", "/api/channels")).body, "data.items.length"), 0);
});

test("a live create without an id gets live-<uuid> from the backend; a sent id is still kept", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  const first = await send(t.app, "POST", "/api/admin/channels", liveBody({ id: undefined }), token);
  const second = await send(t.app, "POST", "/api/admin/channels", liveBody({ id: undefined, number: 8 }), token);
  const sent = await send(t.app, "POST", "/api/admin/channels", liveBody({ id: "home", number: 9 }), token);
  assert.deepEqual([first.status, second.status, sent.status], [201, 201, 201]);
  const id = String(pick(first.body, "data.id"));
  assert.match(id, /^live-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(id.length, 41);
  assert.notEqual(pick(second.body, "data.id"), id);
  assert.equal(pick(first.body, "data.streamUrl"), `http://localhost:80/live/${id}/master.m3u8`);
  assert.equal(pick(sent.body, "data.id"), "home");
  const bad = await send(t.app, "POST", "/api/admin/channels", liveBody({ id: "Not Kebab", number: 10 }), token);
  assert.deepEqual([bad.status, pick(bad.body, "error.code")], [422, "channel.invalid"]);
  await t.live.settled();
});