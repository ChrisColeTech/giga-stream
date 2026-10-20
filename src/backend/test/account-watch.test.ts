// The account's watch routes (docs/63 section 3.2): the fileserver's watch verbs and answers on the
// account's rows, the shared semantics applied at write time with the account's settings, and two
// accounts never seeing each other's history.
import test from "node:test";
import assert from "node:assert/strict";

import { makeApp, pick, send, signIn, type Answer, type TestApp } from "./test-app.js";

const A = { username: "account-a", password: "a-password-1234" };
const B = { username: "account-b", password: "b-password-1234" };
const MOVIE = { kind: "title", id: "movie-603" };
const SERIES = { kind: "title", id: "series-1399" };

const code = (answer: { body: unknown }): unknown => pick(answer.body, "error.code");
const write = (t: TestApp, token: string, body: Record<string, unknown>): Promise<Answer> =>
  send(t.app, "PUT", "/api/account/watch", body, token);
const entriesOf = (body: unknown): unknown[] => (pick(body, "data.entries") as unknown[]) ?? [];

/** The admin mints the two accounts and answers their access tokens. */
async function twoAccounts(t: TestApp): Promise<{ a: string; b: string }> {
  const token = (await signIn(t.app)).access;
  for (const account of [A, B]) {
    const made = await send(t.app, "POST", "/api/admin/accounts", { ...account, kind: "user" }, token);
    assert.equal(made.status, 201);
  }
  const accessOf = async (account: typeof A): Promise<string> => {
    const answer = await send(t.app, "POST", "/api/account/auth/login", account);
    assert.equal(answer.status, 200);
    return String(pick(answer.body, "data.accessToken"));
  };
  return { a: await accessOf(A), b: await accessOf(B) };
}

test("a write lands in the account and the list answers newest first", async () => {
  const t = await makeApp();
  const { a } = await twoAccounts(t);

  const put = await write(t, a, { item: MOVIE, positionMs: 1000, durationMs: 10000, playbackId: "p1", seq: 1 });
  assert.equal(put.status, 200);
  assert.deepEqual(pick(put.body, "data.entry"), {
    watchId: pick(put.body, "data.entry.watchId"),
    item: MOVIE, positionMs: 1000, durationMs: 10000, state: "watching", updatedAt: t.clock.now(),
  });

  t.clock.advance(5);
  await write(t, a, { item: { kind: "local", id: "file-9" }, positionMs: 500, playbackId: "p2", seq: 1 });
  const list = await send(t.app, "GET", "/api/account/watch", undefined, a);
  assert.deepEqual(entriesOf(list.body).map((entry) => pick(entry, "item.id")), ["file-9", "movie-603"]);
  assert.equal(list.headers["cache-control"], "no-store");
  // A write with no duration stores none, and cannot have crossed any threshold.
  assert.equal(pick(list.body, "data.entries.0.durationMs"), undefined);
  assert.equal(pick(list.body, "data.entries.0.state"), "watching");

  t.clock.advance(5);
  const again = await write(t, a, { item: MOVIE, positionMs: 2000, durationMs: 10000, playbackId: "p3", seq: 1 });
  const same = pick(again.body, "data.entry.watchId") === pick(put.body, "data.entry.watchId");
  assert.ok(same, "a re-write is the same entry");
  assert.equal(entriesOf((await send(t.app, "GET", "/api/account/watch", undefined, a)).body).length, 2);
});

test("the threshold reads the account's settings at the write; watched is sticky; the position clamps", async () => {
  const t = await makeApp();
  const { a, b } = await twoAccounts(t);
  await send(t.app, "PUT", "/api/account/settings", { watchedPercent: 95 }, a);
  const asA = (id: string, positionMs: number, playbackId: string, seq = 1) =>
    write(t, a, { item: { kind: "title", id }, positionMs, durationMs: 10000, playbackId, seq });

  // 94% of the duration: watching under the account's 95, watched under the untouched 90 default.
  assert.equal(pick((await asA("movie-a", 9400, "p1")).body, "data.entry.state"), "watching");
  const asB = await write(t, b, { item: { kind: "title", id: "movie-a" }, positionMs: 9400, durationMs: 10000,
    playbackId: "p1", seq: 1 });
  assert.equal(pick(asB.body, "data.entry.state"), "watched");

  // A crossing write marks watched, and the mark is sticky whatever a later playback carries.
  assert.equal(pick((await asA("movie-a", 10000, "p1", 2)).body, "data.entry.state"), "watched");
  t.clock.advance(5);
  const back = await asA("movie-a", 1000, "p2");
  assert.deepEqual([pick(back.body, "data.entry.state"), pick(back.body, "data.entry.positionMs")], ["watched", 1000]);

  // A position past the end is the end, and the threshold's own share counts as watched.
  assert.equal(pick((await asA("movie-b", 99999, "p1")).body, "data.entry.positionMs"), 10000);
  assert.equal(pick((await asA("movie-c", 9500, "p1")).body, "data.entry.state"), "watched");
});

test("a write whose seq lags its playback answers the entry as it stands and changes nothing", async () => {
  const t = await makeApp();
  const { a } = await twoAccounts(t);
  await write(t, a, { item: MOVIE, positionMs: 3000, durationMs: 10000, playbackId: "p1", seq: 2 });
  const late = await write(t, a, { item: MOVIE, positionMs: 9000, durationMs: 10000, playbackId: "p1", seq: 1 });
  assert.deepEqual([pick(late.body, "data.applied"), pick(late.body, "data.entry.positionMs")], [false, 3000]);
  const list = await send(t.app, "GET", "/api/account/watch", undefined, a);
  assert.equal(pick(list.body, "data.entries.0.positionMs"), 3000);
});

test("the identity is the item with its exact episode: an episode and the series are different entries", async () => {
  const t = await makeApp();
  const { a } = await twoAccounts(t);
  const episode = (episode: number, playback: string) =>
    write(t, a, { item: SERIES, season: 1, episode, positionMs: 10, durationMs: 100, playbackId: playback, seq: 1 });

  const first = await episode(1, "p1");
  const again = await episode(1, "p2");
  assert.equal(pick(again.body, "data.entry.watchId"), pick(first.body, "data.entry.watchId"));
  const second = await episode(2, "p3");
  const series = await write(t, a, { item: SERIES, positionMs: 30, durationMs: 100, playbackId: "p4", seq: 1 });
  assert.notEqual(pick(second.body, "data.entry.watchId"), pick(first.body, "data.entry.watchId"));
  assert.notEqual(pick(series.body, "data.entry.watchId"), pick(first.body, "data.entry.watchId"));

  // Written in one tick, the list keeps the insertion order: the series entry is the newest.
  const list = await send(t.app, "GET", "/api/account/watch", undefined, a);
  assert.deepEqual(entriesOf(list.body).map((entry) => [pick(entry, "season"), pick(entry, "episode")]),
    [[undefined, undefined], [1, 2], [1, 1]]);
});

test("a known id answers removed; an unknown or foreign id is 404 watch.not_found", async () => {
  const t = await makeApp();
  const { a, b } = await twoAccounts(t);
  const put = await write(t, a, { item: MOVIE, positionMs: 1000, playbackId: "p1", seq: 1 });
  const watchId = String(pick(put.body, "data.entry.watchId"));

  const foreign = await send(t.app, "DELETE", `/api/account/watch/${watchId}`, undefined, b);
  assert.deepEqual([foreign.status, code(foreign)], [404, "watch.not_found"]);
  const unknown = await send(t.app, "DELETE", "/api/account/watch/no-such-entry", undefined, a);
  assert.deepEqual([unknown.status, code(unknown)], [404, "watch.not_found"]);
  const gone = await send(t.app, "DELETE", `/api/account/watch/${watchId}`, undefined, a);
  assert.deepEqual([gone.status, pick(gone.body, "data")], [200, { removed: watchId }]);
  assert.equal((await send(t.app, "DELETE", `/api/account/watch/${watchId}`, undefined, a)).status, 404);
  assert.deepEqual(pick((await send(t.app, "GET", "/api/account/watch", undefined, a)).body, "data.entries"), []);
});

test("clear empties the account's whole history and nothing else of the account's", async () => {
  const t = await makeApp();
  const { a, b } = await twoAccounts(t);
  await write(t, a, { item: MOVIE, positionMs: 1, playbackId: "p1", seq: 1 });
  await write(t, a, { item: { kind: "title", id: "movie-429" }, positionMs: 1, playbackId: "p2", seq: 1 });
  await write(t, b, { item: MOVIE, positionMs: 1, playbackId: "p1", seq: 1 });
  await send(t.app, "PUT", "/api/account/favorites/title/movie-603", undefined, a);

  const cleared = await send(t.app, "DELETE", "/api/account/watch", undefined, a);
  assert.deepEqual(pick(cleared.body, "data"), { cleared: 2 });
  assert.deepEqual(pick((await send(t.app, "GET", "/api/account/watch", undefined, a)).body, "data.entries"), []);
  assert.equal(entriesOf((await send(t.app, "GET", "/api/account/watch", undefined, b)).body).length, 1);
  assert.deepEqual(pick((await send(t.app, "GET", "/api/account/favorites", undefined, a)).body, "data.items.0.ref"),
    { kind: "title", id: "movie-603" }, "the favorites are untouched");
});

test("pauseHistory on the account pauses its writes; the entry as it stands is answered", async () => {
  const t = await makeApp();
  const { a } = await twoAccounts(t);
  const put = await write(t, a, { item: MOVIE, positionMs: 1000, durationMs: 10000, playbackId: "p1", seq: 1 });
  const watchId = String(pick(put.body, "data.entry.watchId"));
  await send(t.app, "PUT", "/api/account/settings", { pauseHistory: true }, a);
  const paused = await write(t, a, { item: MOVIE, positionMs: 8000, durationMs: 10000, playbackId: "p2", seq: 1 });
  assert.deepEqual([pick(paused.body, "data.applied"), pick(paused.body, "data.entry.watchId")], [false, watchId]);
  const fresh = await write(
    t, a, { item: { kind: "title", id: "movie-429" }, positionMs: 1, playbackId: "p3", seq: 1 },
  );
  assert.equal(pick(fresh.body, "data.entry"), null);
  await send(t.app, "PUT", "/api/account/settings", { pauseHistory: false }, a);
  const resumed = await write(t, a, { item: MOVIE, positionMs: 2000, durationMs: 10000, playbackId: "p4", seq: 1 });
  assert.equal(pick(resumed.body, "data.applied"), true);
});

test("two accounts never see each other's history", async () => {
  const t = await makeApp();
  const { a, b } = await twoAccounts(t);
  await write(t, a, { item: MOVIE, positionMs: 1000, durationMs: 10000, playbackId: "p1", seq: 1 });

  assert.deepEqual(entriesOf((await send(t.app, "GET", "/api/account/watch", undefined, b)).body), []);
  // The same playback id on the other account is its own: b's write applies and a's entry does not move.
  await write(t, b, { item: MOVIE, positionMs: 5000, durationMs: 10000, playbackId: "p1", seq: 1 });
  const list = await send(t.app, "GET", "/api/account/watch", undefined, a);
  assert.deepEqual([entriesOf(list.body).length, pick(list.body, "data.entries.0.positionMs")], [1, 1000]);
  // And b's clear leaves a's row.
  await send(t.app, "DELETE", "/api/account/watch", undefined, b);
  assert.equal(entriesOf((await send(t.app, "GET", "/api/account/watch", undefined, a)).body).length, 1);
});

test("a malformed write is refused whole", async () => {
  const t = await makeApp();
  const { a } = await twoAccounts(t);
  for (const body of [
    { item: MOVIE, positionMs: 1.5, playbackId: "p1", seq: 1 },
    { item: MOVIE, positionMs: -1, playbackId: "p1", seq: 1 },
    { item: MOVIE, positionMs: 1, playbackId: "p1", seq: 0 },
    { item: { kind: "channel", id: "x" }, positionMs: 1, playbackId: "p1", seq: 1 },
    { item: MOVIE, positionMs: 1, playbackId: "p1", seq: 1, season: 0 },
  ]) {
    const answer = await write(t, a, body);
    assert.deepEqual([answer.status, code(answer)], [400, "request.invalid"], JSON.stringify(body));
  }
  assert.deepEqual(entriesOf((await send(t.app, "GET", "/api/account/watch", undefined, a)).body), []);
});

test("every watch route needs a signed-in account", async () => {
  const t = await makeApp();
  for (const [method, url] of [
    ["PUT", "/api/account/watch"], ["GET", "/api/account/watch"],
    ["DELETE", "/api/account/watch"], ["DELETE", "/api/account/watch/w_1"],
  ] as const) {
    const body = method === "PUT" ? { item: MOVIE, positionMs: 1, playbackId: "p1", seq: 1 } : undefined;
    const answer = await send(t.app, method, url, body);
    assert.deepEqual([answer.status, code(answer)], [401, "auth.unauthorized"], url);
  }
});
