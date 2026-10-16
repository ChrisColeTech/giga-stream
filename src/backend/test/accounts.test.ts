import test from "node:test";
import assert from "node:assert/strict";

import { OWNER_EMAIL, makeApp, pick, send, signIn } from "./test-app.js";

const code = (answer: { body: unknown }): unknown => pick(answer.body, "error.code");
const editor = { email: "editor@example.test", name: "Ed", role: "editor", password: "editor-password-1" };

async function ownerToken(t: Awaited<ReturnType<typeof makeApp>>): Promise<string> {
  return (await signIn(t.app)).access;
}

test("the bootstrap owner is the one account of a new backend", async () => {
  const t = await makeApp();
  const list = await send(t.app, "GET", "/api/admin-accounts", undefined, await ownerToken(t));
  assert.equal(list.status, 200);
  assert.equal(list.headers["cache-control"], "no-store");
  const items = pick(list.body, "data.items") as Array<Record<string, unknown>>;
  assert.deepEqual(items.map((a) => [a.email, a.role, a.disabled]), [[OWNER_EMAIL, "owner", false]]);
});

test("an owner creates, reads, updates and deletes an account", async () => {
  const t = await makeApp();
  const token = await ownerToken(t);
  const created = await send(t.app, "POST", "/api/admin-accounts", editor, token);
  assert.equal(created.status, 201);
  const id = String(pick(created.body, "data.id"));
  assert.equal(pick(created.body, "data.role"), "editor");
  assert.equal(JSON.stringify(created.body).includes(editor.password), false);
  assert.equal(pick((await send(t.app, "GET", `/api/admin-accounts/${id}`, undefined, token)).body, "data.email"), editor.email);
  const renamed = await send(t.app, "PATCH", `/api/admin-accounts/${id}`, { name: "Edith" }, token);
  assert.equal(pick(renamed.body, "data.name"), "Edith");
  assert.deepEqual((await send(t.app, "DELETE", `/api/admin-accounts/${id}`, undefined, token)).body, { ok: true, data: { id } });
  assert.equal(code(await send(t.app, "GET", `/api/admin-accounts/${id}`, undefined, token)), "account.not_found");
});

test("an editor manages channels but not accounts or the audit log", async () => {
  const t = await makeApp();
  await send(t.app, "POST", "/api/admin-accounts", editor, await ownerToken(t));
  const { access } = await signIn(t.app, editor.email, editor.password);
  const channel = { name: "News", category: "News", streamUrl: "https://live.example/n.m3u8" };
  assert.equal((await send(t.app, "POST", "/api/channels", channel, access)).status, 201);
  for (const url of ["/api/admin-accounts", "/api/audit"]) {
    const answer = await send(t.app, "GET", url, undefined, access);
    assert.deepEqual([answer.status, code(answer)], [403, "auth.forbidden"]);
  }
});

test("an email already used is account.email_taken, without case", async () => {
  const t = await makeApp();
  const token = await ownerToken(t);
  await send(t.app, "POST", "/api/admin-accounts", editor, token);
  const again = await send(t.app, "POST", "/api/admin-accounts", { ...editor, email: editor.email.toUpperCase() }, token);
  assert.deepEqual([again.status, code(again)], [409, "account.email_taken"]);
});

test("an invalid field is account.invalid, naming the field", async () => {
  const t = await makeApp();
  const token = await ownerToken(t);
  for (const [body, field] of [
    [{ ...editor, password: "short" }, "password"],
    [{ ...editor, email: "not-an-email" }, "email"],
    [{ ...editor, role: "root" }, "role"],
  ] as const) {
    const answer = await send(t.app, "POST", "/api/admin-accounts", body, token);
    assert.deepEqual([answer.status, code(answer), pick(answer.body, "error.details.field")], [422, "account.invalid", field]);
  }
});

test("the last owner cannot be demoted, disabled or deleted", async () => {
  const t = await makeApp();
  const token = await ownerToken(t);
  const ownerId = String(pick((await send(t.app, "GET", "/api/auth/me", undefined, token)).body, "data.id"));
  for (const [method, body] of [["PATCH", { role: "editor" }], ["PATCH", { disabled: true }], ["DELETE", undefined]] as const) {
    const answer = await send(t.app, method, `/api/admin-accounts/${ownerId}`, body, token);
    assert.deepEqual([answer.status, code(answer)], [409, "account.last_owner"]);
  }
  // With a second owner, the first may step down.
  await send(t.app, "POST", "/api/admin-accounts", { ...editor, role: "owner" }, token);
  assert.equal((await send(t.app, "PATCH", `/api/admin-accounts/${ownerId}`, { role: "editor" }, token)).status, 200);
});

test("disabling an account or changing its role ends its sessions at once", async () => {
  const t = await makeApp();
  const token = await ownerToken(t);
  const id = String(pick((await send(t.app, "POST", "/api/admin-accounts", editor, token)).body, "data.id"));
  const session = await signIn(t.app, editor.email, editor.password);
  await send(t.app, "PATCH", `/api/admin-accounts/${id}`, { disabled: true }, token);
  assert.equal((await send(t.app, "GET", "/api/auth/me", undefined, session.access)).status, 401);
  assert.equal((await send(t.app, "POST", "/api/auth/refresh", { refreshToken: session.refresh })).status, 401);
  assert.equal((await send(t.app, "POST", "/api/auth/login", { email: editor.email, password: editor.password })).status, 401);

  await send(t.app, "PATCH", `/api/admin-accounts/${id}`, { disabled: false }, token);
  const again = await signIn(t.app, editor.email, editor.password);
  await send(t.app, "PATCH", `/api/admin-accounts/${id}`, { role: "owner" }, token);
  assert.equal((await send(t.app, "GET", "/api/auth/me", undefined, again.access)).status, 401);
});

test("the audit log records sign-ins and changes, newest first, without secrets", async () => {
  const t = await makeApp();
  const token = await ownerToken(t);
  await send(t.app, "POST", "/api/auth/login", { email: OWNER_EMAIL, password: "wrong-password" });
  const id = String(pick((await send(t.app, "POST", "/api/admin-accounts", editor, token)).body, "data.id"));
  await send(t.app, "POST", "/api/channels", { name: "News", category: "News", streamUrl: "https://live.example/n.m3u8" }, token);
  const audit = await send(t.app, "GET", "/api/audit", undefined, token);
  const items = pick(audit.body, "data.items") as Array<Record<string, unknown>>;
  assert.deepEqual(items.map((e) => e.action), ["channel.created", "account.created", "auth.login_failed", "auth.login", "account.created"]);
  assert.equal(items[1]?.subject, id);
  assert.equal(items[0]?.actorEmail, OWNER_EMAIL);
  assert.equal(items[0]?.address, "127.0.0.1");
  assert.equal(JSON.stringify(audit.body).includes(editor.password), false);
  assert.equal(JSON.stringify(audit.body).includes("wrong-password"), false);

  const page = await send(t.app, "GET", "/api/audit?limit=2", undefined, token);
  assert.equal((pick(page.body, "data.items") as unknown[]).length, 2);
  const before = Number(pick(page.body, "data.nextBefore"));
  const rest = await send(t.app, "GET", `/api/audit?limit=10&before=${before}`, undefined, token);
  assert.equal((pick(rest.body, "data.items") as unknown[]).length, 3);
  assert.equal(pick(rest.body, "data.nextBefore"), undefined);
});
