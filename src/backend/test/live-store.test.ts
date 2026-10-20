// Migration 008 and the channel repository (docs/26 section 3.2): an existing database keeps its stream rows,
// and a live row keeps its settings and its ordered videos.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/store/store.js";
import { NOT_SYNCED, type LiveRecord, type StreamRecord } from "../src/types/channel.js";
import { removeDir, openTestDatabase, queryRow, queryRows, runSql } from "./db-kit.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

/** A database as the backend left it before live channels: migrations 001 to 007, one synced stream row in it. */
async function databaseBefore(dataDir: string): Promise<string> {
  const file = path.join(dataDir, "admin.db");
  const db = await openTestDatabase(file);
  for (const name of readdirSync(MIGRATIONS).sort()) {
    const version = Number(name.slice(0, 3));
    if (version > 7) continue;
    await runSql(db, readFileSync(path.join(MIGRATIONS, name), "utf-8"));
    await runSql(db, `PRAGMA user_version = ${version}`);
  }
  await runSql(db, `INSERT INTO channels (id, name, category, number, logo_url, stream_url, revision, created_at, tvg_id, source)
    VALUES ('ch_old', 'Old News', 'News', '5', 'https://l.example/l.png', 'https://s.example/o.m3u8', 3, 1, 'tv-1', 'cdn.example')`);
  db.close();
  return file;
}

const live = (id: string, number: string, videos: string[], folder: string | null = null): LiveRecord => ({
  kind: "live",
  id,
  name: id,
  category: "News",
  number,
  logoUrl: null,
  revision: 0,
  enabled: true,
  published: true,
  live: { mode: "loop", captions: false, variants: ["360p", "720p"], folder, videos },
});

async function inFolder(work: (dataDir: string) => Promise<void>): Promise<void> {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-store-"));
  try {
    await work(dataDir);
  } finally {
    removeDir(dataDir);
  }
}

test("migration 008 keeps every existing stream row, its sync keys and the revision", async () => {
  await inFolder(async (dataDir) => {
    const store = await createStore(await databaseBefore(dataDir));
    // Migration 022 finds no playlist for the old `source`, so the row is hand-made: no sync name, no parent.
    const expected: StreamRecord = {
      ...NOT_SYNCED,
      kind: "stream",
      id: "ch_old",
      name: "Old News",
      category: "News",
      number: "5",
      logoUrl: "https://l.example/l.png",
      revision: 3,
      streamUrl: "https://s.example/o.m3u8",
      tvgId: "tv-1",
      editedFields: [],
      enabled: true, // migration 013: every existing row is enabled
      published: true,
    };
    assert.deepEqual(await store.channels.find("ch_old"), expected);
    assert.deepEqual(await store.channels.list(), [expected]);
    assert.equal(await store.channels.countLive(), 0);
    store.close();
    const db = await openTestDatabase(path.join(dataDir, "admin.db"));
    try {
      // The schema is at the newest migration, not at 008.
      assert.deepEqual(await queryRows(db, "PRAGMA user_version"), [{ user_version: 31 }]);
    } finally {
      db.close();
    }
  });
});

test("a live row stores its settings and its videos in order, and a change replaces the source", async () => {
  await inFolder(async (dataDir) => {
    const store = await createStore(path.join(dataDir, "admin.db"));
    await store.channels.insert(live("home", "7", ["/v/b.mp4", "/v/a.mp4", "/v/c.mp4"]), 1);
    assert.deepEqual(await store.channels.find("home"), live("home", "7", ["/v/b.mp4", "/v/a.mp4", "/v/c.mp4"]));
    await store.channels.update({ ...live("home", "7", [], "/v/folder"), revision: 2 });
    assert.deepEqual(await store.channels.find("home"), { ...live("home", "7", [], "/v/folder"), revision: 2 });
    await store.channels.update(live("home", "8", ["/v/z.mp4"]));
    assert.deepEqual(await store.channels.find("home"), live("home", "8", ["/v/z.mp4"]));
    assert.equal(await store.channels.countLive(), 1);
    assert.equal(await store.channels.liveNumberHolder("8"), "home");
    assert.equal(await store.channels.liveNumberHolder("7"), undefined);
    store.close();
  });
});

test("a live number is unique among live rows only, and deleting a row takes its videos with it", async () => {
  await inFolder(async (dataDir) => {
    const file = await databaseBefore(dataDir);
    const store = await createStore(file);
    await store.channels.insert(live("one", "1", ["/v/a.mp4"]), 1);
    await assert.rejects(() => store.channels.insert(live("two", "1", ["/v/b.mp4"]), 1), /UNIQUE/);
    await store.channels.insert({ ...(await store.channels.find("ch_old")) as StreamRecord, id: "ch_two", number: "1", tvgId: null }, 1);
    assert.equal((await store.channels.list()).length, 3);
    assert.equal(await store.channels.remove("one"), true);
    store.close();
    const db = await openTestDatabase(file);
    assert.deepEqual(await queryRow(db, "SELECT COUNT(*) AS n FROM channel_videos"), { n: 0 });
    db.close();
  });
});

test("the table refuses a row that is neither a whole stream row nor a whole live row", async () => {
  await inFolder(async (dataDir) => {
    const file = await databaseBefore(dataDir);
    (await createStore(file)).close();
    const db = await openTestDatabase(file);
    await runSql(db, "PRAGMA foreign_keys = ON");
    const insert = (columns: string, values: string) =>
      runSql(db, `INSERT INTO channels (id, name, category, revision, created_at, ${columns}) VALUES ('x', 'x', 'x', 1, 1, ${values})`);
    await assert.rejects(() => insert("kind", "'stream'"), /CHECK/, "a stream row needs an address");
    await assert.rejects(() => insert("kind, stream_url", "'live', 'https://a.example/a.m3u8'"), /CHECK/, "a live row stores none");
    await assert.rejects(() => insert("kind", "'live'"), /CHECK/, "a live row needs its settings");
    await assert.rejects(() => insert("kind, stream_url", "'radio', 'https://a.example/a.m3u8'"), /CHECK/);
    await assert.rejects(() => runSql(db, "INSERT INTO channel_videos (channel_id, position, path) VALUES ('nope', 0, '/a')"), /FOREIGN KEY/);
    db.close();
  });
});