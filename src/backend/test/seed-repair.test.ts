import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { createStore } from "../src/store/store.js";
import { NOT_SYNCED, type StreamRecord } from "../src/types/channel.js";
import { itemOf, itemsOf } from "./live-channel-kit.js";
import { makeApp, pick, send, signIn } from "./test-app.js";

const LEGACY = ["fx-news", "fx-sports", "fx-music", "fx-kids"];

/** The fixture files the seed looks for, as empty placeholders: the fake build never reads them. */
function placeholderFixtures(dataDir: string): string {
  const fixtures = path.join(dataDir, "fixtures");
  mkdirSync(path.join(fixtures, "live"), { recursive: true });
  for (const kind of ["news", "sports", "music", "kids"]) {
    for (const n of [1, 2, 3]) writeFileSync(path.join(fixtures, "live", `${kind}-${n}.mp4`), "");
  }
  return fixtures;
}

/** A row as the retired standalone live server's import left it in a database that predates the merge. */
const legacyRow = (id: string, overrides: Partial<StreamRecord> = {}): Omit<StreamRecord, "revision"> => ({
  ...NOT_SYNCED, kind: "stream", id, name: `Old ${id}`, category: "News", number: null, logoUrl: null, enabled: true,
  published: true, streamUrl: `http://127.0.0.1:8097/live/${id}/master.m3u8`, tvgId: null, editedFields: [],
  ...overrides,
});

/** Builds the database as the old version left it: the migrated schema with these stream rows in it. */
function oldDatabase(dataDir: string, rows: Array<Omit<StreamRecord, "revision">>): void {
  const store = createStore(path.join(dataDir, "admin.db"));
  try {
    for (const row of rows) store.transaction(() => store.channels.insert({ ...row, revision: store.revisions.next() }, 0));
  } finally {
    store.close();
  }
}

async function withDir(work: (dataDir: string, fixtures: string) => Promise<void>): Promise<void> {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-repair-"));
  try {
    await work(dataDir, placeholderFixtures(dataDir));
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
}

test("the seed turns the four legacy stream rows into live rows with the same ids, once", async () => {
  await withDir(async (dataDir, fixtures) => {
    oldDatabase(dataDir, LEGACY.map((id) => legacyRow(id)));
    const first = await makeApp({ seed: true, dataDir, config: { FIXTURE_DIR: fixtures } });
    const list = (await send(first.app, "GET", "/api/channels")).body;
    assert.deepEqual(itemsOf(list).map((c) => [c.id, c.name, c.number, c.category, c.kind]), [
      ["fx-news", "Fixture News", "1", "News", "live"],
      ["fx-sports", "Fixture Sports", "2", "Sports", "live"],
      ["fx-music", "Fixture Music", "3", "Music", "live"],
      ["fx-kids", "Fixture Kids", "4", "Kids", "live"],
    ]);
    assert.equal(itemOf(list, "fx-news").streamUrl, "http://localhost:80/live/fx-news/master.m3u8");
    // Four legacy revisions (1 to 4), then one bump per repaired row: a connected client sees the change.
    assert.equal(pick(list, "data.revision"), 8);
    for (const c of itemsOf(list)) assert.ok(Number(c.revision) > 4, `${String(c.id)} revision was not bumped`);

    await first.live.settled();
    const token = (await signIn(first.app)).access;
    const admin = (await send(first.app, "GET", "/api/admin-channels", undefined, token)).body;
    assert.deepEqual(itemsOf(admin).map((c) => [c.id, c.mode, c.state, c.captions, (c.variants as string[]).length]), [
      ["fx-news", "loop", "live", true, 2],
      ["fx-sports", "loop", "live", false, 3],
      ["fx-music", "loop", "live", false, 2],
      ["fx-kids", "loop", "live", false, 2],
    ]);
    assert.deepEqual(itemOf(admin, "fx-news").videos, [1, 2, 3].map((n) => path.join(fixtures, "live", `news-${n}.mp4`)));
    await first.dispose();

    // A second start changes nothing: no row, no revision.
    const second = await makeApp({ seed: true, dataDir, config: { FIXTURE_DIR: fixtures } });
    const again = (await send(second.app, "GET", "/api/channels")).body;
    assert.equal(pick(again, "data.revision"), 8);
    assert.deepEqual(itemsOf(again).map((c) => [c.id, c.kind, c.revision]), itemsOf(list).map((c) => [c.id, c.kind, c.revision]));
    await second.dispose();
  });
});

test("the repair touches only the exact legacy shape of the seed's own ids", async () => {
  await withDir(async (dataDir, fixtures) => {
    oldDatabase(dataDir, [
      legacyRow("fx-news", { editedFields: ["name"] }),
      legacyRow("fx-sports", { streamUrl: "http://127.0.0.1:8097/live/other/master.m3u8" }),
      legacyRow("fx-music", { streamUrl: "http://tv.example.test/live/fx-music/master.m3u8" }),
      legacyRow("ch_own"),
      legacyRow("fx-kids"),
    ]);
    const t = await makeApp({ seed: true, dataDir, config: { FIXTURE_DIR: fixtures } });
    const list = (await send(t.app, "GET", "/api/channels")).body;
    assert.deepEqual(itemsOf(list).map((c) => [c.id, c.kind, c.revision]), [
      // The repaired row is numbered, so it lists first; the others keep their old revisions, listed by name.
      ["fx-kids", "live", 6],
      ["ch_own", "stream", 4],
      ["fx-music", "stream", 3],
      ["fx-news", "stream", 1],
      ["fx-sports", "stream", 2],
    ]);
    assert.equal(itemOf(list, "fx-news").name, "Old fx-news");
    assert.equal(itemOf(list, "fx-sports").streamUrl, "http://127.0.0.1:8097/live/other/master.m3u8");
    assert.equal(itemOf(list, "fx-music").streamUrl, "http://tv.example.test/live/fx-music/master.m3u8");
    assert.equal(itemOf(list, "ch_own").streamUrl, "http://127.0.0.1:8097/live/ch_own/master.m3u8");
    assert.equal(itemOf(list, "fx-kids").kind, "live");
    await t.dispose();
  });
});

test("a non-empty table gains no test channels, and a live row is left alone", async () => {
  await withDir(async (dataDir, fixtures) => {
    oldDatabase(dataDir, [legacyRow("ch_own")]);
    const t = await makeApp({ seed: true, dataDir, config: { FIXTURE_DIR: fixtures } });
    const list = (await send(t.app, "GET", "/api/channels")).body;
    assert.deepEqual(itemsOf(list).map((c) => c.id), ["ch_own"]);
    assert.equal(pick(list, "data.revision"), 1);
    await t.dispose();
  });
});

test("a legacy row with the fixture files missing refuses to start, naming the command", async () => {
  await withDir(async (dataDir) => {
    oldDatabase(dataDir, [legacyRow("fx-news")]);
    await assert.rejects(
      makeApp({ seed: true, dataDir, config: { FIXTURE_DIR: path.join(dataDir, "no-fixtures") } }),
      /npm run fixtures/,
    );
  });
});
