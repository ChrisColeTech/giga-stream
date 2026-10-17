import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { makeApp, pick, send, type FileserverApp } from "./app-fixture.js";

const write = (app: FileserverApp["app"], body: Record<string, unknown>) => send(app, "PUT", "/api/watch", body);

/** The backend is honestly unreachable (a port nothing listens on), so rows carry their skeleton facts. */
const closeBackend = (app: FileserverApp["app"]) => send(app, "PATCH", "/api/settings", { adminUrl: "http://127.0.0.1:1" });

test("a watch write survives closing and reopening the data folder (Continue Watching after a relaunch)", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-watch-restart-"));
  try {
    const first = await makeApp({ dataDir });
    await closeBackend(first.app);
    await write(first.app, {
      item: { kind: "title", id: "movie-603" },
      positionMs: 1_800_000,
      durationMs: 7_200_000,
      playbackId: "p1",
      seq: 1,
    });
    first.clock.advance(60_000); // the test clock is frozen: "newest first" needs distinct times
    await write(first.app, {
      item: { kind: "title", id: "tv-1399" },
      season: 1,
      episode: 2,
      positionMs: 0,
      playbackId: "p2",
      seq: 1,
    });
    await first.dispose();

    // A new process is a new playback id space: the same ids restart at seq 1 and still apply.
    const second = await makeApp({ dataDir });
    const history = await send(second.app, "GET", "/api/library?view=history");
    const rows = pick(history.body, "data.items") as Array<Record<string, unknown>>;
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((row) => pick(row, "ref.id")),
      ["tv-1399", "movie-603"],
      "newest first",
    );
    const continued = await send(second.app, "GET", "/api/library/continue");
    const items = pick(continued.body, "data.items") as Array<Record<string, unknown>>;
    assert.deepEqual(
      items.map((row) => pick(row, "progress.state")),
      ["watching", "watching"],
    );
    const movie = items.find((row) => pick(row, "ref.id") === "movie-603");
    assert.equal(pick(movie, "progress.positionMs"), 1_800_000);
    assert.equal(pick(movie, "progress.durationMs"), 7_200_000);
    const episode = items.find((row) => pick(row, "ref.id") === "tv-1399");
    assert.equal(pick(episode, "progress.durationMs"), undefined, "no invented duration");
    assert.equal(pick(episode, "progress.season"), 1);
    assert.equal(pick(episode, "progress.episode"), 2);

    const again = await write(second.app, {
      item: { kind: "title", id: "movie-603" },
      positionMs: 1,
      playbackId: "p1",
      seq: 1,
    });
    assert.equal(pick(again.body, "data.applied"), true);
    await second.dispose();
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("an opening write at position 0 keeps the stored duration and a later one keeps the row", async () => {
  const t = await makeApp();
  await closeBackend(t.app);
  const item = { kind: "title", id: "movie-1" };
  await write(t.app, { item, positionMs: 600_000, durationMs: 6_000_000, playbackId: "a", seq: 1 });
  // The next Play of the same item opens a new playback that writes its saved position and no duration.
  const reopened = await write(t.app, { item, positionMs: 600_000, playbackId: "b", seq: 1 });
  assert.equal(pick(reopened.body, "data.entry.durationMs"), 6_000_000);
  assert.equal(pick(reopened.body, "data.entry.state"), "watching");
  const list = await send(t.app, "GET", "/api/library/continue");
  assert.equal((pick(list.body, "data.items") as unknown[]).length, 1);
  await t.dispose();
});

test("a position past the duration is stored as the duration and finishes the item", async () => {
  const t = await makeApp();
  await closeBackend(t.app);
  const answer = await write(t.app, {
    item: { kind: "title", id: "movie-2" },
    positionMs: 6_100_000,
    durationMs: 6_000_000,
    playbackId: "a",
    seq: 1,
  });
  assert.equal(pick(answer.body, "data.entry.positionMs"), 6_000_000);
  assert.equal(pick(answer.body, "data.entry.state"), "watched");
  const list = await send(t.app, "GET", "/api/library/continue");
  assert.deepEqual(pick(list.body, "data.items"), [], "a watched item leaves Continue Watching");
  await t.dispose();
});

test("pause history stops every write and leaves what is already stored", async () => {
  const t = await makeApp();
  const item = { kind: "title", id: "movie-3" };
  await write(t.app, { item, positionMs: 1000, durationMs: 9000, playbackId: "a", seq: 1 });
  assert.equal((await send(t.app, "PATCH", "/api/settings", { pauseHistory: true })).status, 200);

  const refused = await write(t.app, { item, positionMs: 5000, durationMs: 9000, playbackId: "a", seq: 2 });
  assert.equal(pick(refused.body, "data.applied"), false);
  assert.equal(pick(refused.body, "data.entry.positionMs"), 1000, "the stored entry is unchanged");
  const created = await write(t.app, { item: { kind: "title", id: "movie-4" }, positionMs: 1, playbackId: "b", seq: 1 });
  assert.equal(pick(created.body, "data.applied"), false);
  assert.equal(pick(created.body, "data.entry"), null, "no entry was created");

  assert.equal((await send(t.app, "PATCH", "/api/settings", { pauseHistory: false })).status, 200);
  const resumed = await write(t.app, { item, positionMs: 5000, durationMs: 9000, playbackId: "a", seq: 3 });
  assert.equal(pick(resumed.body, "data.applied"), true, "a paused write does not burn its playback's seq");
  assert.equal(pick(resumed.body, "data.entry.positionMs"), 5000);
  await t.dispose();
});

test("a malformed progress write is 400", async () => {
  const t = await makeApp();
  const item = { kind: "title", id: "movie-5" };
  const good = { item, positionMs: 1000, playbackId: "a", seq: 1 };
  assert.equal((await write(t.app, good)).status, 200);
  const bad: Array<Record<string, unknown>> = [
    { ...good, positionMs: 1.5 },
    { ...good, positionMs: -1 },
    { ...good, durationMs: 0 },
    { ...good, playbackId: "" },
    { ...good, seq: 0 },
    { ...good, season: 0, episode: 1 },
    { ...good, item: { kind: "title", id: "" } },
  ];
  for (const body of bad) assert.equal((await write(t.app, body)).status, 400, JSON.stringify(body));
  await t.dispose();
});

test("the per-playback ordering memory is bounded, so a very old playback may write again", async () => {
  const t = await makeApp();
  const item = { kind: "title", id: "movie-6" };
  await write(t.app, { item, positionMs: 1000, playbackId: "first", seq: 5 });
  for (let at = 0; at < 600; at += 1) {
    await write(t.app, { item, positionMs: 2000, playbackId: `later-${at}`, seq: 1 });
  }
  // "first" was forgotten; a low seq from it applies again instead of growing the map without end.
  const replay = await write(t.app, { item, positionMs: 3000, playbackId: "first", seq: 1 });
  assert.equal(pick(replay.body, "data.applied"), true);
  await t.dispose();
});
