// Migration 029 (docs/51 decisions 1 and 2): the channel-health words rename live/dead to online/offline. The test
// builds a version-28 database at test time (migrations 001 to 028, then rows in the old words; nothing binary is
// committed) and checks the mapping of `channels.status` and `jobs.last_counts`, what must stay untouched, and the
// rebuilt CHECK.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { Client } from "@libsql/client";

import { createStore } from "../src/store/store.js";
import { removeDir, openTestDatabase, queryRows, runSql } from "./db-kit.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");
const PLAYLIST_COUNTS =
  '{"created":1,"updated":2,"skipped":0,"refused":0,"source":"file","logosCached":3,"logosFailed":0,' +
  '"live":5,"dead":2,"unchecked":1,"refusalExamples":[]}';
const MIGRATED_COUNTS = {
  created: 1, updated: 2, skipped: 0, refused: 0, source: "file", logosCached: 3, logosFailed: 0,
  online: 5, offline: 2, unchecked: 1, refusalExamples: [],
};
const rows = (db: Client, sql: string): Promise<Array<Record<string, unknown>>> => queryRows(db, sql);

/** A database as version 28 left it: three playlists, their jobs, and channels carrying the old words. */
async function version28(dir: string): Promise<string> {
  const file = path.join(dir, "admin.db");
  const db = await openTestDatabase(file);
  try {
    await runSql(db, "PRAGMA foreign_keys = ON");
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 28) continue;
      await runSql(db, readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      await runSql(db, `PRAGMA user_version = ${version}`);
    }
    await runSql(db, `INSERT INTO playlists (id, name, kind, file_name, enabled, created_at) VALUES (1, 'one', 'file', 'one.m3u', 1, 1);
      INSERT INTO playlists (id, name, kind, url, host, enabled, created_at) VALUES (2, 'two', 'url', 'https://h.example/x.m3u', 'h.example', 1, 1);
      INSERT INTO playlists (id, name, kind, file_name, enabled, created_at) VALUES (3, 'three', 'file', 'three.m3u', 1, 1)`);
    const job = (id: number, name: string | null, type: string, playlistId: number | null, at: number | null,
      result: string | null, counts: string | null): Promise<unknown> =>
      db.execute({
        sql: `INSERT INTO sync_jobs (id, name, type, enabled, schedule, config, playlist_id,
          last_run_at, last_result, last_counts, created_at) VALUES (?, ?, ?, 1, '24h', '{}', ?, ?, ?, ?, 1)`,
        args: [id, name, type, playlistId, at, result, counts],
      });
    await job(1, null, "playlist", 1, 100, "ok", PLAYLIST_COUNTS);
    await job(2, null, "playlist", 2, 200, "ok", '{"code":"internal.failure"}'); // a failed run: no verdict keys, untouched
    await job(3, "Fill", "catalog", null, 300, "ok", '{"titles":7,"stale":0}'); // a catalog run: untouched
    await job(4, null, "playlist", 3, null, null, null); // never run: stays NULL
    const channel = (id: string, name: string, url: string | null, kind: string, mode: string | null,
      captions: number | null, variants: string | null, status: string | null, checkedAt: number | null): Promise<unknown> =>
      db.execute({
        sql: `INSERT INTO channels (id, name, category, stream_url, revision, created_at, kind,
          live_mode, live_captions, live_variants, enabled, status, checked_at) VALUES (?, ?, 'News', ?, 1, 1, ?, ?, ?, ?, 1, ?, ?)`,
        args: [id, name, url, kind, mode, captions, variants, status, checkedAt],
      });
    await channel("on", "On", "https://s.example/on.m3u8", "stream", null, null, null, "live", 10);
    await channel("off", "Off", "https://s.example/off.m3u8", "stream", null, null, null, "dead", 20);
    await channel("raw", "Raw", "https://s.example/raw.m3u8", "stream", null, null, null, null, null);
    await channel("air", "On air", null, "live", "loop", 0, '["360p","720p"]', null, null);
    await runSql(db, "INSERT INTO channel_videos (channel_id, position, path) VALUES ('air', 0, '/v/a.mp4')");
    await runSql(db, `INSERT INTO audit_log (at, actor_username, action, subject, detail)
      VALUES (5, 'boss@example.test', 'channel.status.set', 'on', '{"name":"On","from":null,"to":"dead"}')`);
  } finally {
    db.close();
  }
  return file;
}

async function inFolder(work: (dir: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-029-"));
  try {
    await work(dir);
  } finally {
    removeDir(dir);
  }
}

test("029 maps the stored verdicts and the run-count keys, and leaves history and the live rows alone", async () => {
  await inFolder(async (dir) => {
    const file = await version28(dir);
    (await createStore(file)).close();
    assert.ok(existsSync(`${file}.pre-029`), "a table rebuild backs the database up first");
    const db = await openTestDatabase(file);
    await runSql(db, "PRAGMA foreign_keys = ON");
    try {
      assert.deepEqual(await queryRows(db, "PRAGMA user_version"), [{ user_version: 32 }]);
      assert.deepEqual(await rows(db, "PRAGMA foreign_key_check"), []);
      assert.deepEqual(await rows(db, "SELECT id, status, checked_at FROM channels WHERE kind = 'stream' ORDER BY id"), [
        { id: "off", status: "offline", checked_at: 20 },
        { id: "on", status: "online", checked_at: 10 },
        { id: "raw", status: null, checked_at: null },
      ], "live -> online, dead -> offline, not-checked stays NULL");
      assert.deepEqual(await rows(db, "SELECT * FROM channels WHERE kind = 'live'"), [{
        id: "air", name: "On air", category: "News", number: null, logo_url: null, stream_url: null, revision: 1,
        created_at: 1, tvg_id: null, kind: "live", live_mode: "loop", live_captions: 0, live_variants: '["360p","720p"]',
        live_folder: null, edited_fields: null, sync_name: null, enabled: 1, playlist_id: null, status: null,
        checked_at: null, logo_file: null, logo_checked_at: null,
      }], "a live-kind row is carried over whole");
      assert.deepEqual(await rows(db, "SELECT channel_id, position, path FROM channel_videos ORDER BY channel_id"),
        [{ channel_id: "air", position: 0, path: "/v/a.mp4" }], "the listed videos survive the rebuild");
      assert.deepEqual(await rows(db, "SELECT detail FROM audit_log WHERE action = 'channel.status.set'"),
        [{ detail: '{"name":"On","from":null,"to":"dead"}' }], "audit history keeps the words it was written with");
      const counts = (await rows(db, "SELECT id, last_counts FROM sync_jobs ORDER BY id")).map((j) => ({
        id: j.id, counts: j.last_counts === null ? null : JSON.parse(String(j.last_counts)),
      }));
      assert.deepEqual(counts, [
        { id: 1, counts: MIGRATED_COUNTS },
        { id: 2, counts: { code: "internal.failure" } },
        { id: 3, counts: { titles: 7, stale: 0 } },
        { id: 4, counts: null },
      ], "only the playlist counts' verdict keys are renamed, each where it is present");
      await assert.rejects(() => runSql(db, "UPDATE channels SET status = 'live' WHERE id = 'on'"), /CHECK/,
        "the old word is no longer a legal value");
      await assert.rejects(() => runSql(db, "UPDATE channels SET status = 'offline' WHERE id = 'air'"), /CHECK/,
        "a verdict is still a stream row's word only");
      await assert.doesNotReject(() => runSql(db, "UPDATE channels SET status = 'online' WHERE id = 'on'"));
    } finally {
      db.close();
    }
  });
});