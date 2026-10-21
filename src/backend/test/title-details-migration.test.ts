// Migration 026 (docs/47 sections 3.1 and 3.4): the details bookkeeping columns on `titles` (nullable, so every stored
// title is kept as it was) and the stored genre dictionary. Forward-only.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/store/store.js";
import { removeDir, openTestDatabase, queryRow, queryRows, runSql } from "./db-kit.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

test("026 lands on a version-25 database: the titles are kept, the new columns are empty, the genre table is there", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-details-migration-"));
  try {
    const file = path.join(dir, "admin.db");
    const old = await openTestDatabase(file);
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 25) continue;
      await runSql(old, readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      await runSql(old, `PRAGMA user_version = ${version}`);
    }
    await runSql(old, "INSERT INTO titles (id, kind, tmdb_id, origin, payload, fetched_at) VALUES ('movie-1', 'movie', 1, 'tmdb', '{\"shape\":\"list\"}', 5)");
    old.close();

    const store = await createStore(file);
    assert.equal((await store.titles.find("movie", 1))?.fetchedAt, 5);
    assert.deepEqual(await store.titles.genres("movie"), []);
    await store.titles.replaceGenres("movie", [{ id: 18, name: "Drama" }]);
    assert.deepEqual(await store.titles.genres("movie"), [{ id: 18, name: "Drama" }]);
    store.close();

    const db = await openTestDatabase(file);
    try {
      assert.equal((await queryRow(db, "PRAGMA user_version"))?.user_version, 32);
      const columns = (await queryRows(db, "PRAGMA table_info(titles)")).filter((c) => String(c.name).startsWith("detail_"));
      assert.deepEqual(columns.map((c) => [c.name, c.notnull]), [["detail_failed_at", 0], ["detail_failures", 0]]);
      assert.deepEqual(await queryRows(db, "SELECT detail_failed_at, detail_failures FROM titles"),
        [{ detail_failed_at: null, detail_failures: null }]);
      assert.deepEqual(await queryRows(db, "PRAGMA foreign_key_check"), []);
    } finally {
      db.close();
    }
  } finally {
    removeDir(dir);
  }
});