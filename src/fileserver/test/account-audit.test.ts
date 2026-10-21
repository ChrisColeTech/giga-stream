import assert from "node:assert/strict";
import test from "node:test";
import type { FastifyInstance } from "fastify";

import { makeApp, pick, send, type FileserverApp } from "./app-fixture.js";

const secretValues = ["viewer-password", "new-password", "Rex", "refreshToken", "accessToken"];

async function signup(t: FileserverApp) {
  return send(t.app, "POST", "/api/account/auth/register", {
    username: " viewer ", password: "viewer-password", securityQuestion: 1, securityAnswer: "Rex",
  });
}

async function call(
  app: FastifyInstance,
  method: "GET" | "PATCH" | "POST" | "PUT" | "DELETE",
  url: string,
  token: string,
  body?: unknown,
) {
  const reply = await app.inject({
    method, url,
    headers: { authorization: `Bearer ${token}`, ...(body !== undefined && { "content-type": "application/json" }) },
    ...(body !== undefined && { payload: JSON.stringify(body) }),
  });
  return { status: reply.statusCode, body: reply.body === "" ? null : JSON.parse(reply.body) as unknown };
}

test("account and preference writes append disciplined audit entries without secrets", async () => {
  const t = await makeApp();
  const registered = await signup(t);
  const token = String(pick(registered.body, "data.accessToken"));
  await send(t.app, "POST", "/api/account/auth/login", { username: "viewer", password: "wrong" });
  const login = await send(t.app, "POST", "/api/account/auth/login", {
    username: "viewer", password: "viewer-password",
  });
  await send(t.app, "POST", "/api/account/auth/logout", {
    refreshToken: pick(login.body, "data.refreshToken"),
  });
  await call(t.app, "PATCH", "/api/account/me", token, { username: "Viewer Two" });
  await call(t.app, "PUT", "/api/account/settings", token, { watchedPercent: 95 });
  await call(t.app, "PUT", "/api/account/favorites/title/movie-1", token);
  await call(t.app, "DELETE", "/api/account/favorites/title/movie-1", token);
  const made = await call(t.app, "POST", "/api/account/collections", token, { name: "Queue", type: "movie" });
  const collectionId = String(pick(made.body, "data.id"));
  await call(t.app, "PUT", `/api/account/collections/${collectionId}/items`, token, {
    kind: "title", id: "movie-1",
  });
  await call(t.app, "PATCH", `/api/account/collections/${collectionId}`, token, { name: "Queue Two" });
  await call(t.app, "DELETE", `/api/account/collections/${collectionId}/items/title/movie-1`, token);
  await call(t.app, "DELETE", `/api/account/collections/${collectionId}`, token);
  const watched = await call(t.app, "PUT", "/api/account/watch", token, {
    item: { kind: "title", id: "movie-1" }, positionMs: 10, playbackId: "p1", seq: 1,
  });
  await call(t.app, "DELETE", `/api/account/watch/${String(pick(watched.body, "data.entry.watchId"))}`, token);
  await call(t.app, "PUT", "/api/account/watch", token, {
    item: { kind: "title", id: "movie-2" }, positionMs: 10, playbackId: "p2", seq: 1,
  });
  await call(t.app, "DELETE", "/api/account/watch", token);
  await call(t.app, "POST", "/api/account/auth/password", token, {
    currentPassword: "viewer-password", newPassword: "temporary-password",
  });
  await send(t.app, "POST", "/api/auth/reset", {
    username: "Viewer Two", answer: "wrong", newPassword: "new-password",
  });
  await send(t.app, "POST", "/api/auth/reset", {
    username: "Viewer Two", answer: "rex", newPassword: "new-password",
  });

  const rows = (await t.adminDatabase.execute(
    "SELECT action, subject, detail, actor_id, actor_username, address FROM audit_log ORDER BY id",
  )).rows;
  const actions = rows.map((row) => row.action);
  for (const action of [
    "account.created", "auth.login_failed", "auth.login", "auth.logout", "account.updated",
    "settings.updated", "favorite.added", "favorite.removed", "collection.created",
    "collection.updated", "collection.item_added", "collection.item_removed", "collection.deleted",
    "watch.updated", "watch.deleted", "watch.cleared", "auth.password_changed",
    "auth.reset_failed", "auth.reset_completed",
  ]) assert.ok(actions.includes(action), action);
  assert.ok(rows.some((row) => row.actor_username === "viewer" && row.actor_id !== null));
  assert.ok(rows.every((row) => typeof row.address === "string"));
  const serialized = JSON.stringify(rows);
  for (const secret of secretValues) assert.equal(serialized.includes(secret), false, secret);
  await t.dispose();
});

test("a failed audit append rolls back the account mutation", async () => {
  const t = await makeApp();
  const registered = await signup(t);
  const token = String(pick(registered.body, "data.accessToken"));
  await t.adminDatabase.execute("DROP TABLE audit_log");
  const failed = await call(t.app, "PUT", "/api/account/settings", token, { watchedPercent: 100 });
  assert.equal(failed.status, 500);
  assert.equal((await t.adminDatabase.execute("SELECT COUNT(*) AS n FROM user_settings")).rows[0]?.n, 0);
  await t.dispose();
});

test("signup and its refresh token roll back when account.created cannot be audited", async () => {
  const t = await makeApp();
  await t.adminDatabase.execute("DROP TABLE audit_log");
  const failed = await signup(t);
  assert.equal(failed.status, 500);
  assert.equal((await t.adminDatabase.execute("SELECT COUNT(*) AS n FROM admin_accounts")).rows[0]?.n, 0);
  assert.equal((await t.adminDatabase.execute("SELECT COUNT(*) AS n FROM refresh_tokens")).rows[0]?.n, 0);
  await t.dispose();
});

test("logout clears the account cookie even when the refresh token is invalid", async () => {
  const t = await makeApp();
  const reply = await t.app.inject({
    method: "POST", url: "/api/account/auth/logout",
    headers: { "content-type": "application/json" }, payload: JSON.stringify({ refreshToken: "invalid" }),
  });
  assert.equal(reply.statusCode, 401);
  assert.match(String(reply.headers["set-cookie"]), /giga_refresh=; Max-Age=0/);
  await t.dispose();
});
