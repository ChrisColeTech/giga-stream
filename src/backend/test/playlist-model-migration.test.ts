// Migration 022 (docs/43 section 6): the playlist model. The test builds a version-21 database at test time (migrations
// 001 to 021, then rows in the old shape; nothing binary is committed) and checks every guarantee of the migration.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { Client } from "@libsql/client";

import { AppError, ERRORS } from "../src/constants/errors.js";
import { createStore } from "../src/store/store.js";
import { removeDir, openTestDatabase, queryRow, queryRows, runSql } from "./db-kit.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");
const LIVE_VARIANTS = '["360p","720p"]';
const rows = (db: Client, sql: string): Promise<Array<Record<string, unknown>>> => queryRows(db, sql);

/** A database as version 21 left it, holding every shape the migration must carry over (see the asserts below). */
async function version21(dir: string): Promise<string> {
  const file = path.join(dir, "admin.db");
  const db = await openTestDatabase(file);
  await runSql(db, "PRAGMA foreign_keys = ON");
  for (const name of readdirSync(MIGRATIONS).sort()) {
    const version = Number(name.slice(0, 3));
    if (version > 21) continue;
    await runSql(db, readFileSync(path.join(MIGRATIONS, name), "utf-8"));
    await runSql(db, `PRAGMA user_version = ${version}`);
  }
  const playlist = (
    id: number, name: string, address: string, host: string,
  ): Promise<unknown> =>
    db.execute({
      sql: "INSERT INTO playlists (id, name, address, host, enabled, last_synced_at, last_outcome, created_at) VALUES (?, ?, ?, ?, 1, 5, 'Synced: 3 created', 10)",
      args: [id, name, address, host],
    });
  await playlist(1, "Cable", "https://cdn.example/a.m3u8?token=SECRET", "cdn.example");
  await playlist(2, "cable", "https://cdn.example/b.m3u8", "cdn.example"); // a second playlist on one host, and a clashing name
  await playlist(3, "us.m3u", "stored:us.m3u", "us.m3u");
  for (const id of [5, 6, 7, 8]) await playlist(id, `Extra ${id}`, `https://extra${id}.example/l.m3u`, `extra${id}.example`);
  await playlist(9, "Gone", "https://gone.example/l.m3u", "gone.example");
  await runSql(db, "DELETE FROM playlists WHERE id = 9"); // the counter stays at 9: that id must never come back
  const job = (
    id: number, name: string, type: string, schedule: string, config: string, at: number | null,
    outcome: string | null, counts: string | null,
  ): Promise<unknown> =>
    db.execute({
      sql: "INSERT INTO sync_jobs (id, name, type, enabled, schedule, config, last_run_at, last_outcome, last_counts, created_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, 20)",
      args: [id, name, type, schedule, config, at, outcome, counts],
    });
  const cfg = (id: number) => JSON.stringify({ playlistId: id, dryRun: true, prune: true });
  await job(1, "Sync one", "playlist", "30s", cfg(1), 100, "Synced: 3 created", '{"created":3,"removed":0,"createdIds":["a"]}');
  await job(2, "Sync one again", "playlist", "6h", cfg(1), null, null, null); // a second job for playlist 1: dropped
  await job(3, "Sync us", "playlist", "6h", cfg(3), 100, "ok", null);
  await job(4, "Sync lost", "playlist", "1h", cfg(99), null, null, null); // its playlist is gone: dropped
  for (const [id, plist, schedule] of [[5, 5, "10m"], [6, 6, "15m"], [7, 7, "off"], [8, 8, "500ms"]] as const) {
    await job(id, `Sync ${id}`, "playlist", schedule, cfg(plist), null, null, null);
  }
  await job(10, "Library fill", "catalog", "12h", '{"scope":"discover","pages":3}', 100, "ok", '{"titles":7}');
  await job(11, "Series", "catalog", "off", '{"scope":"popular","kind":"tv","pages":2}', 200, "TMDB said no", null);
  await job(12, "Never", "catalog", "off", '{"scope":"trending","kind":"movie","pages":1}', null, null, null);
  const channel = (
    id: string, name: string, number: string | null, url: string | null, source: string | null, kind: string,
    mode: string | null, captions: number | null, variants: string | null, edited: string | null,
    sync: string | null, playlistId: number | null,
  ): Promise<unknown> =>
    db.execute({
      sql: `INSERT INTO channels (id, name, category, number, logo_url, stream_url, revision, created_at,
        tvg_id, source, kind, live_mode, live_captions, live_variants, live_folder, edited_fields, sync_name, enabled, playlist_id)
        VALUES (?, ?, 'News', ?, NULL, ?, 1, 1, NULL, ?, ?, ?, ?, ?, NULL, ?, ?, 0, ?)`,
      args: [id, name, number, url, source, kind, mode, captions, variants, edited, sync, playlistId],
    });
  const stream = (
    id: string, name: string, source: string | null, playlistId: number | null, sync: string | null, edited: string | null = null,
  ): Promise<unknown> =>
    channel(id, name, null, `https://s.example/${id}.m3u8`, source, "stream", null, null, null, edited, sync, playlistId);
  await stream("c1", "ABC", "cdn.example", 1, "ABC", '["name"]'); // already has its parent
  await stream("c2", "By file", "stored:us.m3u", null, "By file"); // finds playlist 3 by its file
  await stream("c3", "Ambiguous", "cdn.example", null, "Old", '["name"]'); // two playlists on the host: hand-made
  await stream("c4", "Dangling file", "stored:us.m3u", 99, "Dangling file"); // lost its parent, finds playlist 3
  await stream("c5", "Dangling none", null, 98, "Dangling none"); // lost its parent, no source: hand-made
  await stream("c6", "Mine", null, null, null);
  await stream("c7", "No sync name", "cdn.example", 1, null); // a parent but no sync name: it takes its name
  for (const [id, number, parent] of [["live-a", "1", 1], ["live-b", "2", null]] as const) {
    await channel(id, id, number, null, null, "live", "loop", 0, LIVE_VARIANTS, null, null, parent);
  }
  const video = (channelId: string, position: number, file: string): Promise<unknown> =>
    db.execute({ sql: "INSERT INTO channel_videos (channel_id, position, path) VALUES (?, ?, ?)", args: [channelId, position, file] });
  for (const [at, file] of ["/v/1.mp4", "/v/2.mp4", "/v/3.mp4"].entries()) await video("live-a", at, file);
  await video("live-b", 0, "/v/z.mp4");
  db.close();
  return file;
}

async function inFolder(work: (dir: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-022-"));
  try {
    await work(dir);
  } finally {
    removeDir(dir);
  }
}

test("022 on a version-21 database keeps the channels and videos, rebuilds playlists, jobs and channels, and backs up first", async () => {
  await inFolder(async (dir) => {
    const file = await version21(dir);
    (await createStore(file)).close();
    const backup = await openTestDatabase(`${file}.pre-022`);
    assert.deepEqual([
      (await queryRow(backup, "PRAGMA user_version"))?.user_version,
      (await rows(backup, "SELECT COUNT(*) AS n FROM channels"))[0]?.n,
    ], [21, 9]);
    assert.ok((await rows(backup, "PRAGMA table_info(playlists)")).some((c) => c.name === "address"), "the backup is the old shape");
    backup.close();

    const db = await openTestDatabase(file);
    await runSql(db, "PRAGMA foreign_keys = ON");
    try {
      assert.equal((await queryRow(db, "PRAGMA user_version"))?.user_version, 30);
      assert.deepEqual(await rows(db, "PRAGMA foreign_key_check"), []);
      assert.deepEqual(await rows(db, "SELECT COUNT(*) AS n FROM channels"), [{ n: 9 }]);
      assert.deepEqual(
        (await rows(db, "SELECT channel_id, position, path FROM channel_videos ORDER BY channel_id, position")).map((v) => `${v.channel_id}${v.position}${v.path}`),
        ["live-a0/v/1.mp4", "live-a1/v/2.mp4", "live-a2/v/3.mp4", "live-b0/v/z.mp4"]);
      assert.ok((await rows(db, "PRAGMA index_list(channels)")).some((i) => i.name === "channels_live_number"), "the live-number index is back");
      assert.ok((await rows(db, "PRAGMA index_list(channels)")).some((i) => i.name === "channels_playlist"));
      await assert.rejects(() => runSql(db, "UPDATE channels SET number = '1' WHERE id = 'live-b'"), /UNIQUE/);

      assert.deepEqual(await rows(db, "SELECT id, name, kind, url, file_name, host FROM playlists WHERE id <= 3 ORDER BY id"), [
        { id: 1, name: "Cable", kind: "url", url: "https://cdn.example/a.m3u8?token=SECRET", file_name: null, host: "cdn.example" },
        { id: 2, name: "cable (2)", kind: "url", url: "https://cdn.example/b.m3u8", file_name: null, host: "cdn.example" },
        { id: 3, name: "us.m3u", kind: "file", url: null, file_name: "us.m3u", host: null },
      ]);
      assert.deepEqual(await rows(db, "SELECT name FROM sqlite_sequence WHERE name = 'playlists' AND seq >= 9").then((r) => r.length), 1);
      const inserted = await db.execute({
        sql: "INSERT INTO playlists (name, kind, url, host, created_at) VALUES ('New', 'url', 'https://n.example/a', 'n.example', 1)",
      });
      assert.equal(Number(inserted.lastInsertRowid), 10);

      const playlistJobs = await rows(db, "SELECT playlist_id, name, enabled, schedule, config, last_run_at, last_result, last_counts FROM sync_jobs WHERE type = 'playlist' ORDER BY playlist_id");
      assert.deepEqual(playlistJobs.map((j) => [j.playlist_id, j.schedule]), [[1, "15m"], [2, "24h"], [3, "6h"], [5, "15m"], [6, "15m"], [7, "off"], [8, "15m"]]);
      assert.ok(playlistJobs.every((j) => j.name === null && j.config === "{}" && j.last_run_at === null && j.last_result === null && j.last_counts === null && j.enabled === 1));
      assert.deepEqual(await rows(db, "SELECT id FROM sync_jobs WHERE playlist_id = 1"), [{ id: 1 }], "the lowest id per playlist is kept");
      assert.deepEqual(await rows(db, "SELECT id, name, schedule, config, last_run_at, last_result, last_counts FROM sync_jobs WHERE type = 'catalog' ORDER BY id"), [
        { id: 10, name: "Library fill", schedule: "12h", config: '{"scope":"discover"}', last_run_at: 100, last_result: "ok", last_counts: '{"titles":7,"stale":0}' },
        { id: 11, name: "Series", schedule: "off", config: '{"scope":"popular","kind":"tv","pages":2}', last_run_at: 200, last_result: "failed", last_counts: '{"code":"internal.failure"}' },
        { id: 12, name: "Never", schedule: "off", config: '{"scope":"trending","kind":"movie","pages":1}', last_run_at: null, last_result: null, last_counts: null },
      ]);
      assert.ok(Number((await rows(db, "SELECT seq FROM sqlite_sequence WHERE name = 'sync_jobs'"))[0]?.seq) >= 12);

      assert.deepEqual(await rows(db, "SELECT id, playlist_id, sync_name, edited_fields, enabled FROM channels WHERE kind = 'stream' ORDER BY id"), [
        { id: "c1", playlist_id: 1, sync_name: "ABC", edited_fields: '["name"]', enabled: 0 },
        { id: "c2", playlist_id: 3, sync_name: "By file", edited_fields: null, enabled: 0 },
        { id: "c3", playlist_id: null, sync_name: null, edited_fields: null, enabled: 0 },
        { id: "c4", playlist_id: 3, sync_name: "Dangling file", edited_fields: null, enabled: 0 },
        { id: "c5", playlist_id: null, sync_name: null, edited_fields: null, enabled: 0 },
        { id: "c6", playlist_id: null, sync_name: null, edited_fields: null, enabled: 0 },
        { id: "c7", playlist_id: 1, sync_name: "No sync name", edited_fields: null, enabled: 0 },
      ]);
      assert.deepEqual((await rows(db, "SELECT id FROM channels WHERE playlist_id IS NULL ORDER BY id")).map((r) => r.id),
        ["c3", "c5", "c6", "live-a", "live-b"], "the ambiguous and the dangling rows are hand-made, and so are the live rows");
      assert.ok((await rows(db, "PRAGMA table_info(channels)")).every((c) => c.name !== "source"), "channels.source is gone");
      assert.deepEqual(
        await rows(db, "SELECT COUNT(*) AS n FROM channels WHERE status IS NOT NULL OR checked_at IS NOT NULL OR logo_file IS NOT NULL OR logo_checked_at IS NOT NULL"),
        [{ n: 0 }]);
      assert.deepEqual(await rows(db, "SELECT id FROM channels WHERE kind = 'live' AND playlist_id IS NOT NULL"), [], "a live row has no parent");
      await runSql(db, "DELETE FROM playlists WHERE id = 3");
      assert.deepEqual(await rows(db, "SELECT id FROM channels WHERE id IN ('c2', 'c4')"), [], "deleting the playlist now cascades to its channels");
      assert.deepEqual(await rows(db, "SELECT id FROM sync_jobs WHERE playlist_id = 3"), []);
    } finally {
      db.close();
    }
  });
});

test("a fresh database is not backed up; an existing backup file is left alone", async () => {
  await inFolder(async (dir) => {
    const fresh = path.join(dir, "fresh", "admin.db");
    (await createStore(fresh)).close();
    assert.equal(existsSync(`${fresh}.pre-022`), false, "a database at version 0 has nothing to save");
    const file = await version21(dir);
    writeFileSync(`${file}.pre-022`, "an earlier backup");
    (await createStore(file)).close();
    assert.equal(readFileSync(`${file}.pre-022`, "utf-8"), "an earlier backup", "VACUUM INTO would fail on it, so it is skipped");
  });
});

test("a migration that leaves a broken reference is rolled back whole and the database stays at 21", async () => {
  await inFolder(async (dir) => {
    const file = await version21(dir);
    const db = await openTestDatabase(file);
    await runSql(db, "PRAGMA foreign_keys = OFF");
    await runSql(db, "INSERT INTO channel_videos (channel_id, position, path) VALUES ('no-such-channel', 0, '/v/x.mp4')");
    db.close();
    await assert.rejects(() => createStore(file), (error: unknown) => error instanceof AppError && error.code === ERRORS.storeMigrate.code);
    const after = await openTestDatabase(file);
    assert.equal((await queryRow(after, "PRAGMA user_version"))?.user_version, 21);
    assert.ok((await rows(after, "PRAGMA table_info(playlists)")).some((c) => c.name === "address"), "the old tables are untouched");
    assert.deepEqual(await rows(after, "SELECT COUNT(*) AS n FROM channels"), [{ n: 9 }]);
    after.close();
    assert.ok(existsSync(`${file}.pre-022`), "and the backup was written before it ran");
  });
});