import assert from "node:assert/strict";
import test from "node:test";

import { makeApp, pick, send, type FileserverApp } from "./app-fixture.js";

const write = { item: { kind: "title" as const, id: "movie-1" }, positionMs: 1_000, playbackId: "p1", seq: 1 };

async function signup(t: FileserverApp, username = "viewer"): Promise<string> {
  const answer = await send(t.app, "POST", "/api/account/auth/register", {
    username, password: "password", securityQuestion: 1, securityAnswer: "Rex",
  });
  return String(pick(answer.body, "data.accessToken"));
}

async function browser(
  t: FileserverApp,
  method: "PUT" | "DELETE",
  url: string,
  token?: string,
  body?: unknown,
) {
  const reply = await t.app.inject({
    method, url,
    headers: {
      ...(token !== undefined && { authorization: `Bearer ${token}` }),
      ...(body !== undefined && { "content-type": "application/json" }),
    },
    ...(body !== undefined && { payload: JSON.stringify(body) }),
  });
  return { status: reply.statusCode, body: JSON.parse(reply.body) as unknown };
}

test("electron-marked watch writes stay in the local store", async () => {
  const t = await makeApp();
  const answer = await send(t.app, "PUT", "/api/watch", write);
  assert.equal(pick(answer.body, "data.applied"), true);
  assert.equal(pick(answer.body, "data.entry.item.id"), "movie-1");
  const cloud = await t.adminDatabase.execute("SELECT COUNT(*) AS n FROM user_watch");
  assert.equal(cloud.rows[0]?.n, 0);
  await t.dispose();
});

test("browser watch writes land directly in the bearer account and never call admin HTTP", async () => {
  const seen: string[] = [];
  const t = await makeApp({ adminFetch: async (input) => {
    seen.push(String(input)); throw new Error("unexpected outbound request");
  } });
  const token = await signup(t);
  const answer = await browser(t, "PUT", "/api/watch", token, write);
  assert.equal(pick(answer.body, "data.applied"), true);
  const rows = await t.adminDatabase.execute("SELECT item_id, position_ms FROM user_watch");
  assert.deepEqual(rows.rows.map((row) => ({ ...row })), [{ item_id: "movie-1", position_ms: 1_000 }]);
  assert.deepEqual(seen, []);
  await t.dispose();
});

test("a browser write without a valid bearer is refused and writes neither store", async () => {
  const t = await makeApp();
  const missing = await browser(t, "PUT", "/api/watch", undefined, write);
  const expired = await browser(t, "PUT", "/api/watch", "expired", write);
  assert.deepEqual([missing.status, pick(missing.body, "error.code")], [401, "auth.unauthorized"]);
  assert.deepEqual([expired.status, pick(expired.body, "error.code")], [401, "auth.unauthorized"]);
  assert.equal((await t.adminDatabase.execute("SELECT COUNT(*) AS n FROM user_watch")).rows[0]?.n, 0);
  await t.dispose();
});

test("browser remove and clear are account-scoped while electron deletes remain local", async () => {
  const t = await makeApp();
  const one = await signup(t, "one");
  const two = await signup(t, "two");
  const written = await browser(t, "PUT", "/api/watch", one, write);
  const id = String(pick(written.body, "data.entry.watchId"));
  const foreign = await browser(t, "DELETE", `/api/watch/${id}`, two);
  assert.deepEqual([foreign.status, pick(foreign.body, "error.code")], [404, "watch.not_found"]);
  assert.equal((await browser(t, "DELETE", `/api/watch/${id}`, one)).status, 200);
  await browser(t, "PUT", "/api/watch", one, { ...write, playbackId: "p2", seq: 2 });
  assert.equal((await browser(t, "DELETE", "/api/watch", one)).status, 200);
  assert.equal((await t.adminDatabase.execute("SELECT COUNT(*) AS n FROM user_watch")).rows[0]?.n, 0);

  const local = await send(t.app, "PUT", "/api/watch", write);
  const localId = String(pick(local.body, "data.entry.watchId"));
  assert.equal((await send(t.app, "DELETE", `/api/watch/${localId}`)).status, 200);
  await t.dispose();
});
