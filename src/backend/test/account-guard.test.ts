// The kind check at the guard (docs/62 D3 and section 3.7): a user's token works on /api/account and is
// refused at /api/admin with the usual 401, indistinguishable from a bad one.
import test from "node:test";
import assert from "node:assert/strict";

import { makeApp, pick, send, signIn, type TestApp } from "./test-app.js";

const USER = { username: "app-user", password: "user-password-1" };

/** The bootstrap admin mints a user account and its sign-in answers. */
async function userSession(t: TestApp): Promise<{ access: string; refresh: string }> {
  const token = (await signIn(t.app)).access;
  const made = await send(t.app, "POST", "/api/admin/accounts", { ...USER, kind: "user" }, token);
  assert.equal(made.status, 201);
  assert.equal(pick(made.body, "data.kind"), "user", "the create answer carries the kind");
  const answer = await send(t.app, "POST", "/api/account/auth/login", USER);
  assert.equal(answer.status, 200);
  return {
    access: String(pick(answer.body, "data.accessToken")),
    refresh: String(pick(answer.body, "data.refreshToken")),
  };
}

test("a created account defaults to admin, and the list and single answers carry the kind", async () => {
  const t = await makeApp();
  const token = (await signIn(t.app)).access;
  const id = String(pick((await send(t.app, "POST", "/api/admin/accounts", USER, token)).body, "data.id"));
  const listed = await send(t.app, "GET", "/api/admin/accounts", undefined, token);
  assert.equal(pick(listed.body, "data.items.0.kind"), "admin");
  const single = await send(t.app, "GET", `/api/admin/accounts/${id}`, undefined, token);
  assert.equal(pick(single.body, "data.kind"), "admin");
  const patched = await send(t.app, "PATCH", `/api/admin/accounts/${id}`, { kind: "user" }, token);
  assert.deepEqual(
    [patched.status, pick(patched.body, "error.details.field")],
    [422, "kind"],
    "a patch cannot move kinds",
  );
});

test("a user token is admitted on the app's routes and refused at the console with the usual 401", async () => {
  const t = await makeApp();
  const { access } = await userSession(t);

  const me = await send(t.app, "GET", "/api/account/me", undefined, access);
  assert.deepEqual(
    [me.status, pick(me.body, "data.kind"), pick(me.body, "data.username")],
    [200, "user", USER.username],
  );

  for (const url of ["/api/admin/accounts", "/api/admin/audit", "/api/admin/auth/me", "/api/admin/account-state"]) {
    const answer = await send(t.app, "GET", url, undefined, access);
    assert.deepEqual([answer.status, pick(answer.body, "error.code")], [401, "auth.unauthorized"], url);
    assert.equal(answer.headers["cache-control"], "no-store");
  }
});

test("an admin token works on both surfaces, and the answers tell the kinds apart", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  assert.equal((await send(t.app, "GET", "/api/admin/accounts", undefined, access)).status, 200);
  const me = await send(t.app, "GET", "/api/account/me", undefined, access);
  assert.equal(pick(me.body, "data.kind"), "admin");
});

test("the console's sign-in itself stays open, and the user's session refreshes at the app's routes", async () => {
  const t = await makeApp();
  const { refresh } = await userSession(t);
  // The login route is under /api/admin but takes anyone (docs/62 section 3.7: the refusal is the guard's).
  const consoleLogin = await send(t.app, "POST", "/api/admin/auth/login", USER);
  assert.equal(consoleLogin.status, 200);
  assert.equal(pick(consoleLogin.body, "data.account.kind"), "user");

  const renewed = await send(t.app, "POST", "/api/account/auth/refresh", { refreshToken: refresh });
  assert.equal(renewed.status, 200);
  assert.equal(typeof pick(renewed.body, "data.accessToken"), "string");
});
