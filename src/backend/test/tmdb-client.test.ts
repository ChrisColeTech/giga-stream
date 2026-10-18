// The TMDB client's stop and retry rules (docs/44 section 3.2): a caller's signal ends its call in the pacing wait, the
// request and a backoff sleep, with no retry after it; a signal caller never joins or cancels a shared request; a 5xx is
// retried with bounded backoff like a 429 and then reads as `tmdb.unavailable`. A local server stands in for TMDB.
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test, { after } from "node:test";

import { AppError } from "../src/constants/errors.js";
import { TMDB_MIN_GAP_MS, TMDB_MIN_REQUESTS_PER_SECOND, TMDB_REQUESTS_PER_SECOND, TMDB_RETRIES } from "../src/constants/limits.js";
import { createTmdbClient } from "../src/services/tmdb-client.js";

const closers: Array<() => Promise<void>> = [];
after(async () => {
  for (const close of closers) await close();
});

type Handler = (response: http.ServerResponse, hit: number) => void;

/** A server that counts requests and answers each with `handle`; a request that is cut short is not an error. */
async function stub(handle: Handler) {
  let hits = 0;
  const sockets = new Set<import("node:net").Socket>();
  const server = http.createServer((_request, response) => handle(response, ++hits));
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  closers.push(() => new Promise<void>((resolve) => {
    for (const socket of sockets) socket.destroy();
    server.close(() => resolve());
  }));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, hits: (): number => hits };
}

const json = (response: http.ServerResponse, body: unknown, status = 200): void => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};
const nap = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const isAbort = (error: unknown): boolean => error instanceof Error && error.name === "AbortError";

test("a 5xx is retried with bounded backoff, then reads as tmdb.unavailable with the status", async () => {
  const server = await stub((response) => json(response, {}, 503));
  const client = createTmdbClient({ token: "t", base: server.base, minGapMs: 0, backoffMs: 1 });
  await assert.rejects(client.get("/x"), (error: unknown) =>
    error instanceof AppError && error.code === "tmdb.unavailable" && error.details?.status === 503);
  assert.equal(server.hits(), 1 + TMDB_RETRIES);
});

test("a 5xx that clears is retried into an answer; a 4xx is not retried", async () => {
  const flaky = await stub((response, hit) => (hit < 3 ? json(response, {}, 502) : json(response, { ok: hit })));
  const client = createTmdbClient({ token: "t", base: flaky.base, minGapMs: 0, backoffMs: 1 });
  assert.deepEqual(await client.get("/x"), { ok: 3 });
  const refusing = await stub((response) => json(response, {}, 404));
  await assert.rejects(createTmdbClient({ token: "t", base: refusing.base, minGapMs: 0, backoffMs: 1 }).get("/x"));
  assert.equal(refusing.hits(), 1);
});

test("the pace is TMDB_REQUESTS_PER_SECOND; each 429 halves it for the rest of the run, down to 2 a second; resetPace restores it", async () => {
  assert.equal(TMDB_MIN_GAP_MS, 1000 / TMDB_REQUESTS_PER_SECOND);
  const throttled = await stub((response) => json(response, {}, 429));
  const client = createTmdbClient({ token: "t", base: throttled.base, backoffMs: 1 });
  assert.equal(client.paceMs(), TMDB_MIN_GAP_MS, "the full pace at first");
  await assert.rejects(client.get("/x", {}, { signal: new AbortController().signal }));
  // 1 + TMDB_RETRIES answers of 429: the gap doubled each time, capped at 20 / 2 = 10 times the full gap.
  assert.equal(client.paceMs(), TMDB_MIN_GAP_MS * (TMDB_REQUESTS_PER_SECOND / TMDB_MIN_REQUESTS_PER_SECOND));
  assert.equal(1000 / client.paceMs(), TMDB_MIN_REQUESTS_PER_SECOND, "never below 2 a second");
  client.resetPace();
  assert.equal(client.paceMs(), TMDB_MIN_GAP_MS);
});

test("one 429 that clears halves the pace once", async () => {
  const flaky = await stub((response, hit) => (hit === 1 ? json(response, {}, 429) : json(response, { ok: true })));
  const client = createTmdbClient({ token: "t", base: flaky.base, minGapMs: 100, backoffMs: 1 });
  await client.get("/x");
  assert.equal(client.paceMs(), 200);
});

test("an abort during a backoff sleep ends the call at once and nothing is retried", async () => {
  const server = await stub((response) => json(response, {}, 503));
  const client = createTmdbClient({ token: "t", base: server.base, minGapMs: 0, backoffMs: 60_000 });
  const stop = new AbortController();
  const call = client.get("/x", {}, { signal: stop.signal });
  const outcome = assert.rejects(call, isAbort);
  while (server.hits() === 0) await nap(5);
  await nap(20);
  const started = Date.now();
  stop.abort();
  await outcome;
  assert.ok(Date.now() - started < 1_000, "it did not wait out the 60 s backoff");
  await nap(50);
  assert.equal(server.hits(), 1, "no retry after the abort");
});

test("an abort during the pacing wait ends the call and sends no request", async () => {
  const server = await stub((response) => json(response, { ok: true }));
  const client = createTmdbClient({ token: "t", base: server.base, minGapMs: 60_000 });
  await client.get("/first");
  const stop = new AbortController();
  const waiting = assert.rejects(client.get("/second", {}, { signal: stop.signal }), isAbort);
  await nap(30);
  stop.abort();
  await waiting;
  assert.equal(server.hits(), 1);
});

test("a request cut short by the abort is not retried as a network error", async () => {
  const server = await stub(() => undefined); // never answers
  const client = createTmdbClient({ token: "t", base: server.base, minGapMs: 0 });
  const stop = new AbortController();
  const call = assert.rejects(client.get("/x", {}, { signal: stop.signal }), isAbort);
  while (server.hits() === 0) await nap(5);
  stop.abort();
  await call;
  await nap(50);
  assert.equal(server.hits(), 1);
  await assert.rejects(client.get("/y", {}, { signal: stop.signal }), isAbort, "an aborted signal sends nothing");
  assert.equal(server.hits(), 1);
});

test("a signal caller does not join or cancel a shared request; callers without one still merge", async () => {
  const server = await stub((response, hit) => setTimeout(() => json(response, { hit }), 150));
  const client = createTmdbClient({ token: "t", base: server.base, minGapMs: 0 });
  const a = client.get("/same");
  const b = client.get("/same");
  assert.equal(client.merging(), 1, "two callers without a signal share one request");
  const stop = new AbortController();
  const mine = assert.rejects(client.get("/same", {}, { signal: stop.signal }), isAbort);
  await nap(30);
  stop.abort();
  await mine;
  assert.deepEqual(await Promise.all([a, b]), [{ hit: 1 }, { hit: 1 }], "the shared request finished for its own callers");
  assert.equal(server.hits(), 1, "the aborted caller never reached the server (its slot did not run)");
});

test("a queued slot of an aborted caller does not run", async () => {
  const server = await stub((response, hit) => setTimeout(() => json(response, { hit }), 100));
  const client = createTmdbClient({ token: "t", base: server.base, minGapMs: 0 });
  const first = client.get("/a");
  const stop = new AbortController();
  const queued = assert.rejects(client.get("/b", {}, { signal: stop.signal }), isAbort);
  stop.abort();
  await queued;
  await first;
  assert.deepEqual(await client.get("/c"), { hit: 2 }, "the next call is the second request: /b was never sent");
});
