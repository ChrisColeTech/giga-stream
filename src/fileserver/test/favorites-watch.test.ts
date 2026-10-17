import test from "node:test";
import assert from "node:assert/strict";

const { makeApp, pick, send } = await import("./app-fixture.js");

test("favorites are idempotent both ways and answer { ref, favorite }", async () => {
  const t = await makeApp();
  const first = await send(t.app, "PUT", "/api/favorites/title/tt111");
  assert.deepEqual(pick(first.body, "data"), { ref: { kind: "title", id: "tt111" }, favorite: true });
  assert.deepEqual((await send(t.app, "PUT", "/api/favorites/title/tt111")).body, first.body);
  const off = await send(t.app, "DELETE", "/api/favorites/title/tt111");
  assert.deepEqual(pick(off.body, "data"), { ref: { kind: "title", id: "tt111" }, favorite: false });
  const emptied = await send(t.app, "DELETE", "/api/favorites/local/local-9");
  assert.deepEqual(pick(emptied.body, "data"), {
    ref: { kind: "local", id: "local-9" },
    favorite: false,
  });
  await t.dispose();
});

test("watch progress applies, replays never rewind, and watched is sticky", async () => {
  const t = await makeApp();
  const write = (body: Record<string, unknown>) => send(t.app, "PUT", "/api/watch", body);
  const first = await write({
    item: { kind: "title", id: "tt100" },
    positionMs: 3000,
    durationMs: 10_000,
    playbackId: "p1",
    seq: 1,
  });
  assert.equal(pick(first.body, "data.applied"), true);
  assert.equal(pick(first.body, "data.entry.state"), "watching");

  // A late write of an old seq is refused but re-answers the entry as it stands.
  const late = await write({ item: { kind: "title", id: "tt100" }, positionMs: 1, playbackId: "p1", seq: 1 });
  assert.equal(pick(late.body, "data.applied"), false);
  assert.equal(pick(late.body, "data.entry.positionMs"), 3000);

  // Past the watchedPercent default of 90 the entry flips to watched...
  const watched = await write({
    item: { kind: "title", id: "tt100" },
    positionMs: 9600,
    durationMs: 10_000,
    playbackId: "p1",
    seq: 2,
  });
  assert.equal(pick(watched.body, "data.entry.state"), "watched");
  // ...and never goes back to watching.
  const back = await write({ item: { kind: "title", id: "tt100" }, positionMs: 10, durationMs: 10_000, playbackId: "p1", seq: 3 });
  assert.equal(pick(back.body, "data.entry.state"), "watched");
  await t.dispose();
});

test("the watched threshold follows the watchedPercent setting, not a constant", async () => {
  const t = await makeApp();
  const write = (body: Record<string, unknown>) => send(t.app, "PUT", "/api/watch", body);
  const patch = await send(t.app, "PATCH", "/api/settings", { watchedPercent: 100 });
  assert.equal(patch.status, 200);
  // 96 percent would flip watched at the old 95 constant; the 100 setting keeps it watching.
  const almost = await write({
    item: { kind: "title", id: "tt300" },
    positionMs: 9600,
    durationMs: 10_000,
    playbackId: "p10",
    seq: 1,
  });
  assert.equal(pick(almost.body, "data.entry.state"), "watching");
  const done = await write({
    item: { kind: "title", id: "tt300" },
    positionMs: 10_000,
    durationMs: 10_000,
    playbackId: "p10",
    seq: 2,
  });
  assert.equal(pick(done.body, "data.entry.state"), "watched");
  await t.dispose();
});

test("an episode is its own entry; removal and clearing answer without touching favorites", async () => {
  const t = await makeApp();
  const episode = await send(t.app, "PUT", "/api/watch", {
    item: { kind: "title", id: "tt200" },
    season: 2,
    episode: 7,
    positionMs: 1200,
    playbackId: "p2",
    seq: 1,
  });
  const watchId = pick(episode.body, "data.entry.watchId") as string;
  const movie = await send(t.app, "PUT", "/api/watch", { item: { kind: "title", id: "tt200" }, positionMs: 5, playbackId: "p2", seq: 2 });
  assert.notEqual(pick(movie.body, "data.entry.watchId"), watchId);

  await send(t.app, "PUT", "/api/favorites/title/tt200");
  const removed = await send(t.app, "DELETE", `/api/watch/${watchId}`);
  assert.deepEqual(pick(removed.body, "data.removed"), watchId);
  assert.equal(pick((await send(t.app, "DELETE", `/api/watch/${watchId}`)).body, "error.code"), "watch.not_found");
  const cleared = await send(t.app, "DELETE", "/api/watch");
  assert.deepEqual(pick(cleared.body, "data.cleared"), 1);
  const favorite = await send(t.app, "PUT", "/api/favorites/title/tt200");
  assert.deepEqual(pick(favorite.body, "data.favorite"), true);
  assert.deepEqual(pick((await send(t.app, "DELETE", "/api/watch")).body, "data.cleared"), 0);
  await t.dispose();
});

test("a watch write whose body is nonsense is 400", async () => {
  const t = await makeApp();
  for (const body of ["nope", {}, { item: { kind: "channel", id: "c" }, positionMs: 1, playbackId: "p", seq: 1 }, { item: { kind: "title", id: "x" }, positionMs: 1 }]) {
    const wrong = await send(t.app, "PUT", "/api/watch", body);
    assert.equal(wrong.status, 400, JSON.stringify(body));
  }
  await t.dispose();
});

test("state answers empty collections and jobs before anything is created", async () => {
  const t = await makeApp();
  const state = await send(t.app, "GET", "/api/state");
  assert.deepEqual(pick(state.body, "data.collections"), []);
  assert.deepEqual(pick(state.body, "data.jobs"), []);
  await t.dispose();
});

test("a browser with no picker lane and no test root answers 409 fs.desktop_required", async () => {
  const t = await makeApp();
  const answer = await send(t.app, "POST", "/api/fs/dialog", {});
  assert.equal(pick(answer.body, "error.code"), "fs.desktop_required");
  await t.dispose();
});
