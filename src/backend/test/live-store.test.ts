// Migration 008 and the channel repository (docs/26 section 3.2): an existing database keeps its stream rows,
// and a live row keeps its settings and its ordered videos.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/store/store.js";
import type { LiveRecord, StreamRecord } from "../src/types/channel.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

/** A database as the backend left it before live channels: migrations 001 to 007, one synced stream row in it. */
function databaseBefore(dataDir: string): string {
  const file = path.join(dataDir, "admin.db");
  const db = new DatabaseSync(file);
  for (const name of readdirSync(MIGRATIONS).sort()) {
    const version = Number(name.slice(0, 3));
    if (version > 7) continue;
    db.exec(readFileSync(path.join(MIGRATIONS, name), "utf-8"));
    db.exec(`PRAGMA user_version = ${version}`);
  }
  db.exec(`INSERT INTO channels (id, name, category, number, logo_url, stream_url, revision, created_at, tvg_id, source)
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
  live: { mode: "loop", captions: false, variants: ["360p", "720p"], folder, videos },
});

function inFolder(work: (dataDir: string) => void): void {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-store-"));
  try {
    work(dataDir);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
}

test("migration 008 keeps every existing stream row, its sync keys and the revision", () => {
  inFolder((dataDir) => {
    const store = createStore(databaseBefore(dataDir));
    const expected: StreamRecord = {
      kind: "stream",
      id: "ch_old",
      name: "Old News",
      category: "News",
      number: "5",
      logoUrl: "https://l.example/l.png",
      revision: 3,
      streamUrl: "https://s.example/o.m3u8",
      tvgId: "tv-1",
      source: "cdn.example",
      syncName: "Old News", // migration 010 gives a synced row the playlist's name it already had
      playlistId: null,
      editedFields: [],
      enabled: true, // migration 013: every existing row is enabled
    };
    assert.deepEqual(store.channels.find("ch_old"), expected);
    assert.deepEqual(store.channels.listSynced(), [expected]);
    assert.equal(store.channels.countLive(), 0);
    store.close();
    const db = new DatabaseSync(path.join(dataDir, "admin.db"), { readOnly: true });
    try {
      // The schema is at the newest migration (019, username), not at 008.
      assert.deepEqual({ ...db.prepare("PRAGMA user_version").get() }, { user_version: 19 });
    } finally {
      db.close();
    }
  });
});

test("a live row stores its settings and its videos in order, and a change replaces the source", () => {
  inFolder((dataDir) => {
    const store = createStore(path.join(dataDir, "admin.db"));
    store.channels.insert(live("home", "7", ["/v/b.mp4", "/v/a.mp4", "/v/c.mp4"]), 1);
    assert.deepEqual(store.channels.find("home"), live("home", "7", ["/v/b.mp4", "/v/a.mp4", "/v/c.mp4"]));
    store.channels.update({ ...live("home", "7", [], "/v/folder"), revision: 2 });
    assert.deepEqual(store.channels.find("home"), { ...live("home", "7", [], "/v/folder"), revision: 2 });
    store.channels.update(live("home", "8", ["/v/z.mp4"]));
    assert.deepEqual(store.channels.find("home"), live("home", "8", ["/v/z.mp4"]));
    assert.equal(store.channels.countLive(), 1);
    assert.equal(store.channels.liveNumberHolder("8"), "home");
    assert.equal(store.channels.liveNumberHolder("7"), undefined);
    store.close();
  });
});

test("a live number is unique among live rows only, and deleting a row takes its videos with it", () => {
  inFolder((dataDir) => {
    const file = databaseBefore(dataDir);
    const store = createStore(file);
    store.channels.insert(live("one", "1", ["/v/a.mp4"]), 1);
    assert.throws(() => store.channels.insert(live("two", "1", ["/v/b.mp4"]), 1), /UNIQUE/);
    store.channels.insert({ ...(store.channels.listSynced()[0] as StreamRecord), id: "ch_two", number: "1", tvgId: null, source: null }, 1);
    assert.equal(store.channels.list().length, 3);
    assert.equal(store.channels.remove("one"), true);
    store.close();
    const db = new DatabaseSync(file, { readOnly: true });
    assert.deepEqual({ ...db.prepare("SELECT COUNT(*) AS n FROM channel_videos").get() }, { n: 0 });
    db.close();
  });
});

test("the table refuses a row that is neither a whole stream row nor a whole live row", () => {
  inFolder((dataDir) => {
    const file = databaseBefore(dataDir);
    createStore(file).close();
    const db = new DatabaseSync(file);
    db.exec("PRAGMA foreign_keys = ON");
    const insert = (columns: string, values: string) =>
      db.exec(`INSERT INTO channels (id, name, category, revision, created_at, ${columns}) VALUES ('x', 'x', 'x', 1, 1, ${values})`);
    assert.throws(() => insert("kind", "'stream'"), /CHECK/, "a stream row needs an address");
    assert.throws(() => insert("kind, stream_url", "'live', 'https://a.example/a.m3u8'"), /CHECK/, "a live row stores none");
    assert.throws(() => insert("kind", "'live'"), /CHECK/, "a live row needs its settings");
    assert.throws(() => insert("kind, stream_url", "'radio', 'https://a.example/a.m3u8'"), /CHECK/);
    assert.throws(() => db.exec("INSERT INTO channel_videos (channel_id, position, path) VALUES ('nope', 0, '/a')"), /FOREIGN KEY/);
    db.close();
  });
});
