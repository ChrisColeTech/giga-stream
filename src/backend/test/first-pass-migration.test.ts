// Migration 024 (docs/43 section 6, "W2's migration"): every playlist job's last run is cleared, so the first full pass -
// logos, then every stream's verdict - runs at the first start after the logo cache and the stream check ship. Catalog
// jobs, their results and every other row are untouched.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/store/store.js";
import { removeDir, openTestDatabase, queryRow, queryRows, runSql } from "./db-kit.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

/** A database as migrations 001 to 023 left it, with two playlists that ran and a catalog job that ran. */
async function database023(dir: string): Promise<string> {
  const file = path.join(dir, "admin.db");
  const db = await openTestDatabase(file);
  try {
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 23) continue;
      await runSql(db, readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      await runSql(db, `PRAGMA user_version = ${version}`);
    }
    await runSql(db, `
      INSERT INTO playlists (id, name, kind, file_name, enabled, created_at) VALUES (1, 'one', 'file', 'one.m3u', 1, 1);
      INSERT INTO playlists (id, name, kind, url, host, enabled, created_at) VALUES (2, 'two', 'url', 'https://h.example/x.m3u', 'h.example', 1, 1);
      INSERT INTO sync_jobs (id, type, enabled, schedule, config, playlist_id, last_run_at, last_result, last_counts, created_at)
        VALUES (1, 'playlist', 1, '24h', '{}', 1, 1000, 'ok', '{"created":0}', 1);
      INSERT INTO sync_jobs (id, type, enabled, schedule, config, playlist_id, last_run_at, last_result, created_at)
        VALUES (2, 'playlist', 0, '15m', '{}', 2, 2000, 'stopped', 1);
      INSERT INTO sync_jobs (id, name, type, enabled, schedule, config, last_run_at, last_result, last_counts, created_at)
        VALUES (3, 'Fill', 'catalog', 1, '12h', '{"scope":"discover","kind":"movie","pages":1}', 3000, 'ok', '{"titles":4,"stale":0}', 1);`);
  } finally {
    db.close();
  }
  return file;
}

test("024 clears the playlist jobs' last run and leaves the catalog job and everything else as it was", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-first-pass-"));
  try {
    const file = await database023(dataDir);
    (await createStore(file)).close();
    const db = await openTestDatabase(file);
    try {
      assert.deepEqual(await queryRows(db, "PRAGMA user_version"), [{ user_version: 31 }]);
      const jobs = await queryRows(db, "SELECT id, type, enabled, schedule, last_run_at, last_result, last_counts FROM sync_jobs ORDER BY id");
      assert.deepEqual(jobs, [
        { id: 1, type: "playlist", enabled: 1, schedule: "24h", last_run_at: null, last_result: "ok", last_counts: '{"created":0}' },
        { id: 2, type: "playlist", enabled: 0, schedule: "15m", last_run_at: null, last_result: "stopped", last_counts: null },
        { id: 3, type: "catalog", enabled: 1, schedule: "12h", last_run_at: 3000, last_result: "ok", last_counts: '{"titles":4,"stale":0}' },
      ]);
      assert.deepEqual(await queryRows(db, "PRAGMA foreign_key_check"), []);
    } finally {
      db.close();
    }
  } finally {
    removeDir(dataDir);
  }
});

test("a database at 024 opens again and nothing runs twice", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-first-pass-twice-"));
  try {
    const file = await database023(dataDir);
    (await createStore(file)).close();
    const store = await createStore(file);
    try {
      await store.jobs.recordRun(1, 5000, "ok", { code: "internal.failure" });
    } finally {
      store.close();
    }
    (await createStore(file)).close();
    const db = await openTestDatabase(file);
    try {
      assert.equal((await queryRow(db, "SELECT last_run_at AS at FROM sync_jobs WHERE id = 1"))?.at, 5000, "024 does not run again");
    } finally {
      db.close();
    }
  } finally {
    removeDir(dataDir);
  }
});