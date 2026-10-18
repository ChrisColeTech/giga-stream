import test from "node:test";
import assert from "node:assert/strict";

import { ADMIN_USERNAME, makeApp, pick, send, signIn } from "./test-app.js";

const code = (answer: { body: unknown }): unknown => pick(answer.body, "error.code");
const second = { username:"second@example.test", name: "Second", password: "second-password-1" };

async function adminToken(t: Awaited<ReturnType<typeof makeApp>>): Promise<string> {
  return (await signIn(t.app)).access;
}

test("the bootstrap admin is the one account of a new backend, and carries no role", async () => {
  const t = await makeApp();
  const list = await send(t.app, "GET", "/api/admin-accounts", undefined, await adminToken(t));
  assert.equal(list.status, 200);
  assert.equal(list.headers["cache-control"], "no-store");
  const items = pick(list.body, "data.items") as Array<Record<string, unknown>>;
  assert.deepEqual(items.map((a) => [a.username,a.disabled, "role" in a]), [[ADMIN_USERNAME, false, false]]);
});

test("an admin creates, reads, updates and deletes an account", async () => {
  const t = await makeApp();
  const token = await adminToken(t);
  const created = await send(t.app, "POST", "/api/admin-accounts", second, token);
  assert.equal(created.status, 201);
  const id = String(pick(created.body, "data.id"));
  assert.equal(JSON.stringify(created.body).includes(second.password), false);
  assert.equal(pick((await send(t.app, "GET", `/api/admin-accounts/${id}`, undefined, token)).body, "data.username"), second.username);
  const renamed = await send(t.app, "PATCH", `/api/admin-accounts/${id}`, { name: "Edith" }, token);
  assert.equal(pick(renamed.body, "data.name"), "Edith");
  assert.deepEqual((await send(t.app, "DELETE", `/api/admin-accounts/${id}`, undefined, token)).body, { ok: true, data: { id } });
  assert.equal(code(await send(t.app, "GET", `/api/admin-accounts/${id}`, undefined, token)), "account.not_found");
});

test("an account created without a role manages channels, accounts and reads the audit log", async () => {
  const t = await makeApp();
  await send(t.app, "POST", "/api/admin-accounts", second, await adminToken(t));
  const { access } = await signIn(t.app, second.username, second.password);
  const channel = { name: "News", category: "News", streamUrl: "https://live.example/n.m3u8" };
  assert.equal((await send(t.app, "POST", "/api/channels", channel, access)).status, 201);
  for (const url of ["/api/admin-accounts", "/api/audit"]) {
    assert.equal((await send(t.app, "GET", url, undefined, access)).status, 200, url);
  }
  const third = { username: "third", name: "Third", password: "third-password-1" };
  assert.equal((await send(t.app, "POST", "/api/admin-accounts", third, access)).status, 201);
});

test("a username already used is account.username_taken, without case, and a patch cannot take it either", async () => {
  const t = await makeApp();
  const token = await adminToken(t);
  await send(t.app, "POST", "/api/admin-accounts", second, token);
  const again = await send(t.app, "POST", "/api/admin-accounts", { ...second, username: "  SECOND@Example.test " }, token);
  assert.deepEqual([again.status, code(again), pick(again.body, "error.details.field")], [409, "account.username_taken", "username"]);
  const id = String(pick((await send(t.app, "POST", "/api/admin-accounts", { ...second, username: "third" }, token)).body, "data.id"));
  const patched = await send(t.app, "PATCH", `/api/admin-accounts/${id}`, { username: "SECOND@example.test" }, token);
  assert.deepEqual([patched.status, code(patched)], [409, "account.username_taken"]);
});

test("a username is any trimmed text of 1 to 254 characters: not an email, kept as typed, found without case", async () => {
  const t = await makeApp();
  const token = await adminToken(t);
  const made = await send(t.app, "POST", "/api/admin-accounts", { ...second, username: "  Big Boss 7  " }, token);
  assert.equal(made.status, 201);
  assert.equal(pick(made.body, "data.username"), "Big Boss 7");
  assert.equal((await signIn(t.app, "big boss 7", second.password)).access.length > 0, true);
  const longest = await send(t.app, "POST", "/api/admin-accounts", { ...second, username: "u".repeat(254) }, token);
  assert.equal(longest.status, 201);
});

test("an invalid field is account.invalid, naming the field; a role is no longer a field", async () => {
  const t = await makeApp();
  const token = await adminToken(t);
  for (const [body, field] of [
    [{ ...second, password: "" }, "password"],
    [{ ...second, password: "x".repeat(257) }, "password"],
    [{ ...second, username: "   " }, "username"],
    [{ ...second, username: "u".repeat(255) }, "username"],
    [{ ...second, email: "second@example.test" }, "email"],
    [{ ...second, role: "owner" }, "role"],
  ] as const) {
    const answer = await send(t.app, "POST", "/api/admin-accounts", body, token);
    assert.deepEqual([answer.status, code(answer), pick(answer.body, "error.details.field")], [422, "account.invalid", field]);
  }
  assert.equal((await send(t.app, "POST", "/api/admin-accounts", { ...second, password: "x" }, token)).status, 201);
});

test("the last enabled account cannot be disabled or deleted", async () => {
  const t = await makeApp();
  const token = await adminToken(t);
  const adminId = String(pick((await send(t.app, "GET", "/api/auth/me", undefined, token)).body, "data.id"));
  for (const [method, body] of [["PATCH", { disabled: true }], ["DELETE", undefined]] as const) {
    const answer = await send(t.app, method, `/api/admin-accounts/${adminId}`, body, token);
    assert.deepEqual([answer.status, code(answer)], [409, "account.last_admin"]);
  }
  // With a second enabled account, the first may be disabled; the second is then the last one.
  const secondId = String(pick((await send(t.app, "POST", "/api/admin-accounts", second, token)).body, "data.id"));
  assert.equal((await send(t.app, "PATCH", `/api/admin-accounts/${adminId}`, { disabled: true }, token)).status, 200);
  const { access } = await signIn(t.app, second.username, second.password);
  const refused = await send(t.app, "DELETE", `/api/admin-accounts/${secondId}`, undefined, access);
  assert.deepEqual([refused.status, code(refused)], [409, "account.last_admin"]);
});

test("disabling an account ends its sessions at once", async () => {
  const t = await makeApp();
  const token = await adminToken(t);
  const id = String(pick((await send(t.app, "POST", "/api/admin-accounts", second, token)).body, "data.id"));
  const session = await signIn(t.app, second.username, second.password);
  await send(t.app, "PATCH", `/api/admin-accounts/${id}`, { disabled: true }, token);
  assert.equal((await send(t.app, "GET", "/api/auth/me", undefined, session.access)).status, 401);
  assert.equal((await send(t.app, "POST", "/api/auth/refresh", { refreshToken: session.refresh })).status, 401);
  assert.equal((await send(t.app, "POST", "/api/auth/login", { username: second.username, password: second.password })).status, 401);

  await send(t.app, "PATCH", `/api/admin-accounts/${id}`, { disabled: false }, token);
  assert.equal((await signIn(t.app, second.username, second.password)).access.length > 0, true);
});

test("the audit log records sign-ins and changes, newest first, without secrets", async () => {
  const t = await makeApp();
  const token = await adminToken(t);
  await send(t.app, "POST", "/api/auth/login", { username: ADMIN_USERNAME, password: "wrong-password" });
  const id = String(pick((await send(t.app, "POST", "/api/admin-accounts", second, token)).body, "data.id"));
  await send(t.app, "POST", "/api/channels", { name: "News", category: "News", streamUrl: "https://live.example/n.m3u8" }, token);
  const audit = await send(t.app, "GET", "/api/audit", undefined, token);
  const items = pick(audit.body, "data.items") as Array<Record<string, unknown>>;
  assert.deepEqual(items.map((e) => e.action), ["channel.created", "account.created", "auth.login_failed", "auth.login", "account.created"]);
  assert.equal(items[1]?.subject, id);
  assert.equal(items[0]?.actorUsername, ADMIN_USERNAME);
  assert.equal(items[0]?.address, "127.0.0.1");
  assert.equal(JSON.stringify(audit.body).includes(second.password), false);
  assert.equal(JSON.stringify(audit.body).includes("wrong-password"), false);
  assert.equal(JSON.stringify(audit.body).includes("role"), false);

  const page = await send(t.app, "GET", "/api/audit?limit=2", undefined, token);
  assert.equal((pick(page.body, "data.items") as unknown[]).length, 2);
  const before = Number(pick(page.body, "data.nextBefore"));
  const rest = await send(t.app, "GET", `/api/audit?limit=10&before=${before}`, undefined, token);
  assert.equal((pick(rest.body, "data.items") as unknown[]).length, 3);
  assert.equal(pick(rest.body, "data.nextBefore"), undefined);
});
