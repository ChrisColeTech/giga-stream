import assert from "node:assert/strict";
import test from "node:test";
import type { FastifyInstance } from "fastify";

import { makeApp, pick, send, type Answer } from "./app-fixture.js";

const registration = {
  username: "viewer", password: "viewer-password", securityQuestion: 1, securityAnswer: "Rex",
};

async function call(app: FastifyInstance, method: "GET" | "PATCH" | "PUT" | "DELETE", url: string,
  token: string, body?: unknown): Promise<Answer> {
  const response = await app.inject({
    method, url,
    headers: { authorization: `Bearer ${token}`, ...(body !== undefined && { "content-type": "application/json" }) },
    ...(body !== undefined && { payload: JSON.stringify(body) }),
  });
  return { status: response.statusCode, body: response.body === "" ? null : JSON.parse(response.body) };
}

test("signup is user-only, sets the account cookie, restores, and updates the username", async () => {
  const t = await makeApp();
  const raw = await t.app.inject({
    method: "POST", url: "/api/account/auth/register",
    headers: { "content-type": "application/json" }, payload: JSON.stringify(registration),
  });
  const body: unknown = JSON.parse(raw.body);
  assert.equal(raw.statusCode, 200);
  assert.equal(pick(body, "data.account.kind"), "user");
  assert.match(String(raw.headers["set-cookie"]), /giga_refresh=.*Path=\/api\/account\/auth.*HttpOnly/);
  const token = String(pick(body, "data.accessToken"));
  const profile = await call(t.app, "PATCH", "/api/account/me", token, { username: "Viewer Two" });
  assert.equal(pick(profile.body, "data.username"), "Viewer Two");
  const accountRow = await t.adminDatabase.execute("SELECT kind, security_answer_hash FROM admin_accounts");
  assert.equal(accountRow.rows[0]?.kind, "user");
  assert.notEqual(accountRow.rows[0]?.security_answer_hash, "rex");
  await t.dispose();
});

test("case-insensitive usernames are unique for registration and profile edits", async () => {
  const t = await makeApp();
  const first = await send(t.app, "POST", "/api/account/auth/register", registration);
  const duplicate = await send(t.app, "POST", "/api/account/auth/register", { ...registration, username: "VIEWER" });
  assert.deepEqual([duplicate.status, pick(duplicate.body, "error.code")], [409, "account.username_taken"]);
  await send(t.app, "POST", "/api/account/auth/register", { ...registration, username: "other" });
  const changed = await call(
    t.app, "PATCH", "/api/account/me", String(pick(first.body, "data.accessToken")), { username: "OTHER" },
  );
  assert.deepEqual([changed.status, pick(changed.body, "error.code")], [409, "account.username_taken"]);
  await t.dispose();
});

test("account data and browser watch writes are isolated and make no admin request", async () => {
  const outbound: string[] = [];
  const t = await makeApp({ adminFetch: async (input) => {
    outbound.push(String(input)); throw new Error("unexpected request");
  } });
  const one = await send(t.app, "POST", "/api/account/auth/register", registration);
  const two = await send(t.app, "POST", "/api/account/auth/register", { ...registration, username: "other" });
  const tokenOne = String(pick(one.body, "data.accessToken"));
  const tokenTwo = String(pick(two.body, "data.accessToken"));
  await call(t.app, "PUT", "/api/account/favorites/title/movie-1", tokenOne);
  const favoritesOne = await call(t.app, "GET", "/api/account/favorites", tokenOne);
  const favoritesTwo = await call(t.app, "GET", "/api/account/favorites", tokenTwo);
  assert.equal(pick(favoritesOne.body, "data.items.0.ref.id"), "movie-1");
  assert.deepEqual(pick(favoritesTwo.body, "data.items"), []);
  const watch = await call(t.app, "PUT", "/api/watch", tokenOne, {
    item: { kind: "title", id: "movie-1" }, positionMs: 900, durationMs: 1_000, playbackId: "p1", seq: 1,
  });
  assert.equal(pick(watch.body, "data.entry.state"), "watched");
  assert.deepEqual(outbound, []);
  await t.dispose();
});

test("refresh rotates once, reuse revokes the replacement, and reset uses normalized answers", async () => {
  const t = await makeApp();
  const signup = await send(t.app, "POST", "/api/account/auth/register", registration);
  const original = String(pick(signup.body, "data.refreshToken"));
  const refreshed = await send(t.app, "POST", "/api/account/auth/refresh", { refreshToken: original });
  assert.equal(refreshed.status, 200);
  const reused = await send(t.app, "POST", "/api/account/auth/refresh", { refreshToken: original });
  assert.deepEqual([reused.status, pick(reused.body, "error.code")], [401, "auth.refresh_invalid"]);
  const replacement = String(pick(refreshed.body, "data.refreshToken"));
  const revoked = await send(t.app, "POST", "/api/account/auth/refresh", { refreshToken: replacement });
  assert.equal(revoked.status, 401);
  const start = await send(t.app, "POST", "/api/auth/reset-start", { username: "viewer" });
  assert.equal(pick(start.body, "data.question"), "What was the name of your first pet?");
  const reset = await send(t.app, "POST", "/api/auth/reset", {
    username: "viewer", answer: "  REX  ", newPassword: "new-password",
  });
  assert.equal(pick(reset.body, "data.reset"), true);
  const login = await send(t.app, "POST", "/api/account/auth/login", {
    username: "viewer", password: "new-password",
  });
  assert.equal(login.status, 200);
  await t.dispose();
});
