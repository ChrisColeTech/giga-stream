// The watch fork (docs/63 section 3.2; docs/03's amended /api/watch rows): the desktop's Electron-marked
// writes land in the fileserver's own store exactly as always; a browser write must carry the account's
// bearer and is passed to the backend's /api/account/watch, its envelope answer returned verbatim.
import assert from "node:assert/strict";
import test from "node:test";

import { makeApp, pick, send, type Answer, type FileserverApp } from "./app-fixture.js";

/** The backend address the pass is pointed at; the stubbed fetch never touches a network. */
const BACKEND = "http://backend.test";
const BEARER = "Bearer account-token-1";

/** The write body every PUT test sends; the identity is the item alone (no episode here). */
const write = { item: { kind: "title", id: "movie-1" }, positionMs: 1_000, playbackId: "p1", seq: 1 };

/** What one outbound call looked like: the parts the fork's contract names. */
interface Outbound {
  url: string;
  method: string;
  authorization: string | null;
  body: string | null;
}

/** A stubbed backend fetch: records every call and answers every one with the same envelope. */
function backendAnswering(status: number, envelope: unknown, seen: Outbound[]): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    seen.push({
      url: String(input),
      method: init?.method ?? "GET",
      authorization: headers.get("authorization"),
      body: typeof init?.body === "string" ? init.body : null,
    });
    return new Response(JSON.stringify(envelope), { status });
  };
}

/** A browser's call to the fileserver: no runtime marker, an optional account bearer. */
async function browserSend(
  app: FileserverApp["app"],
  method: "PUT" | "DELETE",
  url: string,
  body?: unknown,
  authorization?: string,
): Promise<Answer> {
  const reply = await app.inject({
    method,
    url,
    headers: {
      ...(authorization !== undefined && { authorization }),
      ...(body !== undefined && { "content-type": "application/json" }),
    },
    ...(body !== undefined && { payload: JSON.stringify(body) }),
  });
  return { status: reply.statusCode, body: reply.body === "" ? null : JSON.parse(reply.body) };
}

test("an electron-marked write lands in the local store, today's answer, nothing forwarded", async () => {
  const seen: Outbound[] = [];
  const t = await makeApp({ adminProxyTarget: BACKEND, adminFetch: backendAnswering(200, { ok: true }, seen) });
  const answer = await send(t.app, "PUT", "/api/watch", write);
  assert.equal(answer.status, 200);
  assert.equal(pick(answer.body, "data.applied"), true);
  assert.equal(pick(answer.body, "data.entry.item.id"), "movie-1");
  assert.equal(pick(answer.body, "data.entry.state"), "watching");
  assert.equal(typeof pick(answer.body, "data.entry.watchId"), "string");
  assert.deepEqual(seen, [], "the desktop's write never reaches the backend");
  await t.dispose();
});

test("a browser write with a bearer is forwarded with it, the account's answer returned verbatim", async () => {
  const cloud = {
    ok: true,
    data: { applied: true, entry: { watchId: "uw-7", item: write.item, positionMs: 1_000, state: "watching", updatedAt: 5 } },
  };
  const seen: Outbound[] = [];
  const t = await makeApp({ adminProxyTarget: BACKEND, adminFetch: backendAnswering(200, cloud, seen) });
  const answer = await browserSend(t.app, "PUT", "/api/watch", write, BEARER);
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.method, "PUT");
  assert.equal(seen[0]?.url, `${BACKEND}/api/account/watch`);
  assert.equal(seen[0]?.authorization, BEARER);
  assert.deepEqual(JSON.parse(seen[0]?.body ?? "null"), write, "the body rides intact");
  assert.deepEqual([answer.status, answer.body], [200, cloud]);
  await t.dispose();
});

test("a browser write with no bearer is refused 401 with the one sentence, and nothing is forwarded", async () => {
  const seen: Outbound[] = [];
  const t = await makeApp({ adminProxyTarget: BACKEND, adminFetch: backendAnswering(200, { ok: true }, seen) });
  const answer = await browserSend(t.app, "PUT", "/api/watch", write);
  assert.deepEqual([answer.status, pick(answer.body, "error.code")], [401, "auth.unauthorized"]);
  assert.equal(pick(answer.body, "error.message"), "Sign in to keep history.");
  assert.deepEqual(seen, []);
  await t.dispose();
});

test("the backend's own refusal returns verbatim, status included (an expired bearer, say)", async () => {
  const refusal = { ok: false, error: { code: "auth.unauthorized", message: "Sign in to do that." } };
  const seen: Outbound[] = [];
  const t = await makeApp({ adminProxyTarget: BACKEND, adminFetch: backendAnswering(401, refusal, seen) });
  const answer = await browserSend(t.app, "PUT", "/api/watch", write, "Bearer expired");
  assert.deepEqual([answer.status, answer.body], [401, refusal]);
  await t.dispose();
});

test("the removal and the clear fork like the write, each forwarding verb, tail and bearer", async () => {
  const seen: Outbound[] = [];
  const t = await makeApp({
    adminProxyTarget: BACKEND,
    adminFetch: backendAnswering(200, { ok: true, data: { removed: "uw-7" } }, seen),
  });
  const dropped = await browserSend(t.app, "DELETE", "/api/watch/uw-7", undefined, BEARER);
  assert.deepEqual(
    seen.map((call) => [call.method, call.url, call.authorization]),
    [["DELETE", `${BACKEND}/api/account/watch/uw-7`, BEARER]],
  );
  assert.deepEqual([dropped.status, dropped.body], [200, { ok: true, data: { removed: "uw-7" } }]);

  const cleared = await browserSend(t.app, "DELETE", "/api/watch", undefined, BEARER);
  assert.deepEqual([cleared.status, cleared.body], [200, { ok: true, data: { removed: "uw-7" } }]);
  assert.deepEqual(
    seen.map((call) => [call.method, call.url, call.body]),
    [
      ["DELETE", `${BACKEND}/api/account/watch/uw-7`, null],
      ["DELETE", `${BACKEND}/api/account/watch`, null],
    ],
    "a clear carries no body",
  );
  await t.dispose();
});

test("the electron path needs no backend at all: both deletes land locally on the desktop shape", async () => {
  const t = await makeApp();
  const written = await send(t.app, "PUT", "/api/watch", write);
  const watchId = String(pick(written.body, "data.entry.watchId"));
  const dropped = await send(t.app, "DELETE", `/api/watch/${watchId}`);
  assert.deepEqual([dropped.status, pick(dropped.body, "data.removed")], [200, watchId]);
  const cleared = await send(t.app, "DELETE", "/api/watch");
  assert.equal(cleared.status, 200);
  assert.equal(typeof pick(cleared.body, "data.cleared"), "number");
  await t.dispose();
});

test("a backend that does not answer maps to the standard unreachable envelope", async () => {
  const failing: typeof fetch = () => Promise.reject(new Error("connection refused"));
  const t = await makeApp({ adminProxyTarget: BACKEND, adminFetch: failing });
  const answer = await browserSend(t.app, "PUT", "/api/watch", write, BEARER);
  assert.deepEqual([answer.status, pick(answer.body, "error.code")], [503, "backend.unreachable"]);
  await t.dispose();
});

test("no backend configured either: a browser write with a bearer earns the same unreachable answer", async () => {
  const t = await makeApp();
  const answer = await browserSend(t.app, "PUT", "/api/watch", write, BEARER);
  assert.deepEqual([answer.status, pick(answer.body, "error.code")], [503, "backend.unreachable"]);
  await t.dispose();
});
