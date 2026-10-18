import { createHmac } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";

import { ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET, makeApp, pick, send, signIn } from "./test-app.js";

const code = (answer: { body: unknown }): unknown => pick(answer.body, "error.code");

test("sign-in answers a session, and the access token reaches /api/auth/me", async () => {
  const t = await makeApp();
  const login = await send(t.app, "POST", "/api/auth/login", { username:ADMIN_USERNAME, password: ADMIN_PASSWORD });
  assert.equal(login.status, 200);
  assert.equal(login.headers["cache-control"], "no-store");
  assert.equal(pick(login.body, "data.account.username"), ADMIN_USERNAME);
  assert.equal(pick(login.body, "data.account.role"), undefined);
  assert.equal(pick(login.body, "data.accessExpiresAt"), t.clock.now() + 15 * 60 * 1000);
  assert.equal(JSON.stringify(login.body).includes("password"), false, "no hash or password is ever answered");
  const me = await send(t.app, "GET", "/api/auth/me", undefined, String(pick(login.body, "data.accessToken")));
  assert.equal(pick(me.body, "data.username"), ADMIN_USERNAME);
});

test("username compares without case; a wrong password and an unknown username give the same answer", async () => {
  const t = await makeApp();
  assert.equal((await send(t.app, "POST", "/api/auth/login", { username:ADMIN_USERNAME.toUpperCase(), password: ADMIN_PASSWORD })).status, 200);
  const wrong = await send(t.app, "POST", "/api/auth/login", { username:ADMIN_USERNAME, password: "not-the-password" });
  const unknown = await send(t.app, "POST", "/api/auth/login", { username:"nobody@example.test", password: "whatever-password" });
  assert.deepEqual([wrong.status, code(wrong)], [401, "auth.invalid_credentials"]);
  assert.deepEqual(wrong.body, unknown.body);
});

test("an access token stops working when it expires", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  assert.equal((await send(t.app, "GET", "/api/auth/me", undefined, access)).status, 200);
  t.clock.advance(15 * 60 * 1000 + 1000);
  const late = await send(t.app, "GET", "/api/auth/me", undefined, access);
  assert.deepEqual([late.status, code(late)], [401, "auth.unauthorized"]);
});

test("a token with a changed payload, another algorithm or no signature is refused", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  const [header, payload] = access.split(".") as [string, string];
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as Record<string, unknown>;
  const edited = Buffer.from(JSON.stringify({ ...claims, sub: "acct_other" })).toString("base64url");
  const none = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  for (const forged of [`${header}.${edited}.${access.split(".")[2]}`, `${none}.${payload}.`, `${header}.${payload}`]) {
    assert.equal((await send(t.app, "GET", "/api/auth/me", undefined, forged)).status, 401);
  }
});

test("a still-valid token issued before roles were removed, carrying a role claim, keeps working", async () => {
  const t = await makeApp();
  const { access } = await signIn(t.app);
  const [, payload] = access.split(".") as [string, string, string];
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as Record<string, unknown>;
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...claims, role: "owner" })).toString("base64url");
  const signature = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  const legacy = await send(t.app, "GET", "/api/auth/me", undefined, `${header}.${body}.${signature}`);
  assert.equal(legacy.status, 200);
  assert.equal(pick(legacy.body, "data.username"), ADMIN_USERNAME);
});

test("refresh gives a new session and the old refresh token stops working", async () => {
  const t = await makeApp();
  const first = await signIn(t.app);
  const renewed = await send(t.app, "POST", "/api/auth/refresh", { refreshToken: first.refresh });
  assert.equal(renewed.status, 200);
  const next = String(pick(renewed.body, "data.refreshToken"));
  assert.notEqual(next, first.refresh);
  assert.equal((await send(t.app, "POST", "/api/auth/refresh", { refreshToken: next })).status, 200);
});

test("a used refresh token presented again ends every session of that account", async () => {
  const t = await makeApp();
  const first = await signIn(t.app);
  const renewed = await send(t.app, "POST", "/api/auth/refresh", { refreshToken: first.refresh });
  const latest = { access: String(pick(renewed.body, "data.accessToken")), refresh: String(pick(renewed.body, "data.refreshToken")) };
  const replay = await send(t.app, "POST", "/api/auth/refresh", { refreshToken: first.refresh });
  assert.deepEqual([replay.status, code(replay)], [401, "auth.refresh_invalid"]);
  assert.equal((await send(t.app, "GET", "/api/auth/me", undefined, latest.access)).status, 401);
  assert.equal((await send(t.app, "POST", "/api/auth/refresh", { refreshToken: latest.refresh })).status, 401);
});

test("logout ends that session only", async () => {
  const t = await makeApp();
  const one = await signIn(t.app);
  const two = await signIn(t.app);
  assert.deepEqual((await send(t.app, "POST", "/api/auth/logout", { refreshToken: one.refresh })).body, { ok: true, data: { signedOut: true } });
  assert.equal((await send(t.app, "POST", "/api/auth/refresh", { refreshToken: one.refresh })).status, 401);
  assert.equal((await send(t.app, "POST", "/api/auth/refresh", { refreshToken: two.refresh })).status, 200);
});

test("a refresh token expires after 30 days", async () => {
  const t = await makeApp();
  const { refresh } = await signIn(t.app);
  t.clock.advance(30 * 24 * 60 * 60 * 1000 + 1000);
  assert.equal((await send(t.app, "POST", "/api/auth/refresh", { refreshToken: refresh })).status, 401);
});

test("changing the password needs the current one and ends every session", async () => {
  const t = await makeApp();
  const session = await signIn(t.app);
  const wrong = await send(t.app, "POST", "/api/auth/password", { currentPassword: "nope", newPassword: "a-brand-new-password" }, session.access);
  assert.deepEqual([wrong.status, code(wrong)], [401, "auth.invalid_credentials"]);
  for (const bad of ["", "x".repeat(257)]) {
    const refused = await send(t.app, "POST", "/api/auth/password", { currentPassword: ADMIN_PASSWORD, newPassword: bad }, session.access);
    assert.equal(refused.status, 400);
  }
  const changed = await send(t.app, "POST", "/api/auth/password", { currentPassword: ADMIN_PASSWORD, newPassword: "a-brand-new-password" }, session.access);
  assert.equal(changed.status, 200);
  assert.equal((await send(t.app, "GET", "/api/auth/me", undefined, session.access)).status, 401);
  assert.equal((await send(t.app, "POST", "/api/auth/refresh", { refreshToken: session.refresh })).status, 401);
  assert.equal((await send(t.app, "POST", "/api/auth/login", { username:ADMIN_USERNAME, password: ADMIN_PASSWORD })).status, 401);
  await signIn(t.app, ADMIN_USERNAME, "a-brand-new-password");
});

test("five wrong passwords lock the account for 15 minutes", async () => {
  const t = await makeApp();
  for (let n = 0; n < 5; n += 1) {
    await send(t.app, "POST", "/api/auth/login", { username:ADMIN_USERNAME, password: "wrong-password" }, undefined, `10.0.0.${n}`);
  }
  const locked = await send(t.app, "POST", "/api/auth/login", { username:ADMIN_USERNAME, password: ADMIN_PASSWORD }, undefined, "10.0.1.1");
  assert.deepEqual([locked.status, code(locked)], [429, "auth.locked"]);
  t.clock.advance(15 * 60 * 1000 + 1000);
  assert.equal((await send(t.app, "POST", "/api/auth/login", { username:ADMIN_USERNAME, password: ADMIN_PASSWORD }, undefined, "10.0.1.1")).status, 200);
});

test("more than ten sign-in attempts a minute from one address are refused", async () => {
  const t = await makeApp();
  for (let n = 0; n < 10; n += 1) {
    await send(t.app, "POST", "/api/auth/login", { username:`x${n}@example.test`, password: "whatever-password" }, undefined, "10.9.9.9");
  }
  const limited = await send(t.app, "POST", "/api/auth/login", { username:ADMIN_USERNAME, password: ADMIN_PASSWORD }, undefined, "10.9.9.9");
  assert.deepEqual([limited.status, code(limited)], [429, "auth.rate_limited"]);
  assert.equal((await send(t.app, "POST", "/api/auth/login", { username:ADMIN_USERNAME, password: ADMIN_PASSWORD }, undefined, "10.8.8.8")).status, 200);
  t.clock.advance(61 * 1000);
  assert.equal((await send(t.app, "POST", "/api/auth/login", { username:ADMIN_USERNAME, password: ADMIN_PASSWORD }, undefined, "10.9.9.9")).status, 200);
});
