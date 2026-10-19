import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_PASSWORD, ADMIN_USERNAME, makeApp, pick, request, send, type Answer, type TestApp } from "./test-app.js";

const NAME = "giga_refresh";
const FLAGS = ["Path=/api/admin/auth", "HttpOnly", "SameSite=Strict"];

const setCookie = (answer: Answer): string => String(answer.headers["set-cookie"] ?? "");
const valueOf = (cookie: string): string => new RegExp(`${NAME}=([^;]*)`).exec(cookie)?.[1] ?? "";
const code = (answer: Answer): unknown => pick(answer.body, "error.code");

function login(t: TestApp, headers: Record<string, string> = {}): Promise<Answer> {
  const body = { username: ADMIN_USERNAME, password: ADMIN_PASSWORD };
  return request(t.app, { method: "POST", url: "/api/admin/auth/login", body, headers });
}

const withCookie = (t: TestApp, url: string, token: string, body?: unknown): Promise<Answer> =>
  request(t.app, { method: "POST", url, headers: { cookie: `other=1; ${NAME}=${token}` }, ...(body !== undefined && { body }) });

test("login sets the refresh token as an httpOnly SameSite=Strict cookie scoped to /api/admin/auth, not Secure over http", async () => {
  const t = await makeApp();
  const answer = await login(t);
  const cookie = setCookie(answer);
  for (const flag of FLAGS) assert.ok(cookie.includes(flag), `${flag} in ${cookie}`);
  assert.equal(valueOf(cookie), pick(answer.body, "data.refreshToken"));
  assert.ok(cookie.includes(`Max-Age=${365 * 24 * 60 * 60}`));
  assert.equal(cookie.includes("Secure"), false);
  assert.equal(cookie.includes(String(pick(answer.body, "data.accessToken"))), false, "the access token is never in the cookie");
});

test("the cookie is Secure when the request is https", async () => {
  const t = await makeApp({ config: { TRUST_PROXY: true } });
  const cookie = setCookie(await login(t, { "x-forwarded-proto": "https" }));
  assert.ok(cookie.includes("; Secure"), cookie);
});

test("refresh by cookie answers a session and rotates the cookie; the old one then ends every session", async () => {
  const t = await makeApp();
  const first = valueOf(setCookie(await login(t)));
  const renewed = await withCookie(t, "/api/admin/auth/refresh", first);
  assert.equal(renewed.status, 200);
  const next = valueOf(setCookie(renewed));
  assert.notEqual(next, first);
  assert.equal(pick(renewed.body, "data.refreshToken"), next);
  assert.equal(pick(renewed.body, "data.account.username"), ADMIN_USERNAME);
  const replay = await withCookie(t, "/api/admin/auth/refresh", first);
  assert.deepEqual([replay.status, code(replay)], [401, "auth.refresh_invalid"]);
  assert.equal((await withCookie(t, "/api/admin/auth/refresh", next)).status, 401);
});

test("refresh by body still works and also sets the cookie", async () => {
  const t = await makeApp();
  const refreshToken = String(pick((await login(t)).body, "data.refreshToken"));
  const renewed = await send(t.app, "POST", "/api/admin/auth/refresh", { refreshToken });
  assert.equal(renewed.status, 200);
  assert.equal(valueOf(setCookie(renewed)), pick(renewed.body, "data.refreshToken"));
});

test("a bad cookie, or no token at all, is 401 auth.refresh_invalid and the cookie is cleared", async () => {
  const t = await makeApp();
  const bad = await withCookie(t, "/api/admin/auth/refresh", "not-a-real-token");
  assert.deepEqual([bad.status, code(bad)], [401, "auth.refresh_invalid"]);
  assert.equal(valueOf(setCookie(bad)), "");
  assert.ok(setCookie(bad).includes("Max-Age=0"));
  const none = await send(t.app, "POST", "/api/admin/auth/refresh");
  assert.deepEqual([none.status, code(none)], [401, "auth.refresh_invalid"]);
  assert.ok(setCookie(none).includes("Max-Age=0"));
});

test("logout by cookie revokes the token and clears the cookie", async () => {
  const t = await makeApp();
  const token = valueOf(setCookie(await login(t)));
  const out = await withCookie(t, "/api/admin/auth/logout", token);
  assert.deepEqual(out.body, { ok: true, data: { signedOut: true } });
  assert.ok(setCookie(out).includes("Max-Age=0"));
  assert.equal((await withCookie(t, "/api/admin/auth/refresh", token)).status, 401);
});

test("a password change clears the cookie", async () => {
  const t = await makeApp();
  const answer = await login(t);
  const access = String(pick(answer.body, "data.accessToken"));
  const body = { currentPassword: ADMIN_PASSWORD, newPassword: "another-password-456" };
  const changed = await send(t.app, "POST", "/api/admin/auth/password", body, access);
  assert.equal(changed.status, 200);
  assert.ok(setCookie(changed).includes("Max-Age=0"));
});

test("the API stays closed to other origins: no CORS grant on a cross-origin refresh", async () => {
  const t = await makeApp();
  const answer = await request(t.app, { method: "POST", url: "/api/admin/auth/refresh", headers: { origin: "http://evil.example" } });
  assert.equal(answer.headers["access-control-allow-origin"], undefined);
  assert.equal(answer.headers["access-control-allow-credentials"], undefined);
});
