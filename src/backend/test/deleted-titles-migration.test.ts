// Migration 020 (deleted titles): it applies on top of the latest earlier migration (018 here; 019 is built elsewhere),
// keeps the stored titles, and makes the table a restore reads and writes through the store.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/store/store.js";
import { removeDir, openTestDatabase, queryRow, runSql } from "./db-kit.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

/** A database as migrations 001 to 018 left it, with one stored TMDB title. */
async function database018(dir: string): Promise<string> {
  const file = path.join(dir, "admin.db");
  const db = await openTestDatabase(file);
  try {
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 18) continue;
      await runSql(db, readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      await runSql(db, `PRAGMA user_version = ${version}`);
    }
    await db.execute({
      sql: "INSERT INTO titles (id, kind, tmdb_id, origin, payload, fetched_at) VALUES (?, ?, ?, 'tmdb', ?, ?)",
      args: ["movie-603", "movie", 603, JSON.stringify({ title: "The Matrix" }), 5],
    });
  } finally {
    db.close();
  }
  return file;
}

test("020 applies on an 018 database: the title stays, the table is empty, and a record round-trips", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-deleted-titles-"));
  try {
    const file = await database018(dir);
    const store = await createStore(file);
    assert.equal((await store.titles.find("movie", 603))?.fetchedAt, 5);
    assert.deepEqual(await store.deletedTitles.list(), []);
    await store.deletedTitles.record("movie", 603, "The Matrix", 9);
    await store.deletedTitles.record("movie", 603, undefined, 10);
    await store.deletedTitles.record("tv", 603, undefined, 8);
    assert.equal(await store.deletedTitles.has("movie", 603), true);
    assert.deepEqual((await store.deletedTitles.list()).map((r) => [r.kind, r.title, r.deletedAt]), [
      ["movie", "The Matrix", 10], ["tv", undefined, 8],
    ], "one row per kind and id; a repeat keeps the known title");
    assert.equal(await store.deletedTitles.restore("movie", 603), true);
    assert.equal(await store.deletedTitles.restore("movie", 603), false);
    store.close();
    const db = await openTestDatabase(file);
    try {
      const version = await queryRow(db, "PRAGMA user_version");
      assert.equal(Number(Object.values(version ?? {})[0]), 31);
    } finally {
      db.close();
    }
  } finally {
    removeDir(dir);
  }
});