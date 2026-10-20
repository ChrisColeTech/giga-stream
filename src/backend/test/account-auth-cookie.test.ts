// The app's auth (docs/62 sections 3.2 and 3.4, D4): the console's transport with a second cookie instance
// scoped Path=/api/account/auth, plus restore, the reload's cookie-only boot.
import test from "node:test";
import assert from "node:assert/strict";

import { makeApp, pick, request, send, signIn, type Answer, type TestApp } from "./test-app.js";

const USER = { username: "app-user", password: "user-password-1" };
const NAME = "giga_refresh";
const FLAGS = ["Path=/api/account/auth", "HttpOnly", "SameSite=Strict"];

const setCookie = (answer: Answer): string => String(answer.headers["set-cookie"] ?? "");
const valueOf = (cookie: string): string => new RegExp(`${NAME}=([^;]*)`).exec(cookie)?.[1] ?? "";
const code = (answer: Answer): unknown => pick(answer.body, "error.code");

async function appWithUser(): Promise<TestApp> {
  const t = await makeApp();
  // The suite exercises the app's auth as a user account: the create must say so, or the row defaults
  // to admin (docs/62 D1) and every kind assertion below reads the default, not the wiring.
  const made = await send(t.app, "POST", "/api/admin/accounts", { ...USER, kind: "user" }, (await signIn(t.app)).access);
  assert.equal(made.status, 201);
  return t;
}

const login = (t: TestApp): Promise<Answer> => send(t.app, "POST", "/api/account/auth/login", USER);

const withCookie = (t: TestApp, url: string, token: string, body?: unknown): Promise<Answer> =>
  request(t.app, {
    method: "POST",
    url,
    headers: { cookie: `other=1; ${NAME}=${token}` },
    ...(body !== undefined && { body }),
  });

test("the app's login sets the same-named cookie scoped to /api/account/auth, never the access token", async () => {
  const t = await appWithUser();
  const answer = await login(t);
  const cookie = setCookie(answer);
  for (const flag of FLAGS) assert.ok(cookie.includes(flag), `${flag} in ${cookie}`);
  assert.equal(valueOf(cookie), pick(answer.body, "data.refreshToken"));
  assert.equal(cookie.includes(String(pick(answer.body, "data.accessToken"))), false);
  assert.equal(pick(answer.body, "data.account.kind"), "user");
});

test("restore answers a session from the cookie alone and rotates it", async () => {
  const t = await appWithUser();
  const first = valueOf(setCookie(await login(t)));
  const restored = await withCookie(t, "/api/account/auth/restore", first);
  assert.equal(restored.status, 200);
  const next = valueOf(setCookie(restored));
  assert.notEqual(next, first);
  assert.equal(pick(restored.body, "data.account.username"), USER.username);

  // A restore is cookie-only: the body's token is not one, and no cookie is no session.
  const byBody = await send(t.app, "POST", "/api/account/auth/restore", { refreshToken: next });
  assert.deepEqual([byBody.status, code(byBody)], [401, "auth.refresh_invalid"]);
  assert.ok(setCookie(byBody).includes("Max-Age=0"));
  const none = await send(t.app, "POST", "/api/account/auth/restore");
  assert.deepEqual([none.status, code(none)], [401, "auth.refresh_invalid"]);
});

test("refresh rotates; presenting the used token again revokes every session of the account", async () => {
  const t = await appWithUser();
  const session = await send(t.app, "POST", "/api/account/auth/login", USER);
  const access = String(pick(session.body, "data.accessToken"));
  const first = String(pick(session.body, "data.refreshToken"));

  const renewed = await send(t.app, "POST", "/api/account/auth/refresh", { refreshToken: first });
  assert.equal(renewed.status, 200);
  const second = String(pick(renewed.body, "data.refreshToken"));
  assert.notEqual(second, first);

  const replay = await withCookie(t, "/api/account/auth/refresh", first);
  assert.deepEqual([replay.status, code(replay)], [401, "auth.refresh_invalid"]);
  // Reuse means a copied token: even the newer session is dead now.
  assert.equal((await send(t.app, "POST", "/api/account/auth/refresh", { refreshToken: second })).status, 401);
  assert.equal((await send(t.app, "GET", "/api/account/me", undefined, access)).status, 401);
});

test("logout ends the session and clears the cookie", async () => {
  const t = await appWithUser();
  const token = valueOf(setCookie(await login(t)));
  const out = await withCookie(t, "/api/account/auth/logout", token);
  assert.deepEqual(out.body, { ok: true, data: { signedOut: true } });
  assert.ok(setCookie(out).includes("Max-Age=0"));
  assert.equal((await withCookie(t, "/api/account/auth/restore", token)).status, 401);
});

test("the two cookie scopes stay apart: the app's answer never touches the console's cookie path", async () => {
  const t = await appWithUser();
  const consoleLogin = await send(t.app, "POST", "/api/admin/auth/login", USER);
  const appLogin = await login(t);
  assert.ok(setCookie(consoleLogin).includes("Path=/api/admin/auth"));
  assert.ok(setCookie(appLogin).includes("Path=/api/account/auth"));
  assert.equal(setCookie(appLogin).includes("/api/admin"), false);
});
