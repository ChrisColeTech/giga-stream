// Every write of a live channel is gated by a signed-in owner or editor (docs/26 section 3.4); the live server's
// this-computer-only gate is gone, and a disabled account is refused.
import assert from "node:assert/strict";
import test from "node:test";

import { itemOf, liveBody } from "./live-channel-kit.js";
import { makeApp, pick, send, signIn } from "./test-app.js";

/** Every route that changes a channel, or reads what only an admin may see. */
const PROTECTED = [
  ["POST", "/api/channels", liveBody({ id: "second", number: 8 })],
  ["POST", "/api/channels", { name: "News", category: "News", streamUrl: "https://live.example/n.m3u8" }],
  ["PATCH", "/api/channels/home", { name: "Changed" }],
  ["DELETE", "/api/channels/home", undefined],
  ["POST", "/api/channels/home/rebuild", undefined],
  ["PUT", "/api/channels/home/fault", { fault: "stall" }],
  ["DELETE", "/api/channels/home/fault", undefined],
  ["GET", "/api/admin-channels", undefined],
] as const;

const editor = { email: "editor@example.test", name: "Ed", role: "editor", password: "editor-password-1" };

test("without a token or with a bad one, every write route is auth.unauthorized and changes nothing", async () => {
  const t = await makeApp();
  const owner = (await signIn(t.app)).access;
  await send(t.app, "POST", "/api/channels", liveBody(), owner);
  await t.live.settled();
  for (const token of [undefined, "not-a-token"]) {
    for (const [method, url, body] of PROTECTED) {
      const answer = await send(t.app, method, url, body, token);
      assert.deepEqual([answer.status, pick(answer.body, "error.code")], [401, "auth.unauthorized"], `${method} ${url}`);
    }
  }
  const admin = await send(t.app, "GET", "/api/admin-channels", undefined, owner);
  assert.deepEqual([pick(admin.body, "data.items.length"), itemOf(admin.body, "home").name, itemOf(admin.body, "home").fault], [1, "Home Videos", null]);
});

test("the admin view is for an admin: never public and never cached", async () => {
  const t = await makeApp();
  const owner = (await signIn(t.app)).access;
  await send(t.app, "POST", "/api/channels", liveBody(), owner);
  const answer = await send(t.app, "GET", "/api/admin-channels", undefined, owner);
  assert.deepEqual([answer.status, answer.headers["cache-control"]], [200, "no-store"]);
  assert.equal((await send(t.app, "GET", "/api/channels")).status, 200);
});

test("an editor may manage live channels; an account that is disabled is refused on every route", async () => {
  const t = await makeApp();
  const owner = (await signIn(t.app)).access;
  const id = String(pick((await send(t.app, "POST", "/api/admin-accounts", editor, owner)).body, "data.id"));
  const { access } = await signIn(t.app, editor.email, editor.password);
  assert.equal((await send(t.app, "POST", "/api/channels", liveBody(), access)).status, 201);
  assert.equal((await send(t.app, "PUT", "/api/channels/home/fault", { fault: "stall" }, access)).status, 200);
  assert.equal((await send(t.app, "GET", "/api/admin-channels", undefined, access)).status, 200);
  await send(t.app, "PATCH", `/api/admin-accounts/${id}`, { disabled: true }, owner);
  for (const [method, url, body] of PROTECTED) {
    const answer = await send(t.app, method, url, body, access);
    assert.deepEqual([answer.status, pick(answer.body, "error.code")], [401, "auth.unauthorized"], `${method} ${url}`);
  }
  assert.equal((await send(t.app, "GET", "/api/channels/home")).status, 200);
});

test("there is no this-computer gate: a signed-in admin writes from any address, an anonymous one from none", async () => {
  const t = await makeApp();
  const owner = (await signIn(t.app)).access;
  const lan = "192.168.1.20";
  assert.equal((await send(t.app, "POST", "/api/channels", liveBody(), owner, lan)).status, 201);
  assert.equal((await send(t.app, "PUT", "/api/channels/home/fault", { fault: "end" }, owner, lan)).status, 200);
  assert.equal((await send(t.app, "DELETE", "/api/channels/home", undefined, undefined, "127.0.0.1")).status, 401);
  const audit = await send(t.app, "GET", "/api/audit", undefined, owner);
  assert.equal(pick(audit.body, "data.items.1.address"), lan);
});
