// Migration 027 (docs/11 section 7.3): the nullable `omdb_failed_at` on `titles`. Forward-only; every stored title is kept.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/store/store.js";
import { removeDir, openTestDatabase, queryRow, queryRows, runSql } from "./db-kit.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

test("027 lands on a version-26 database: the titles are kept, omdb_failed_at is empty and nullable, and an OMDb block is queued", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-omdb-migration-"));
  try {
    const file = path.join(dir, "admin.db");
    const old = await openTestDatabase(file);
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 26) continue;
      await runSql(old, readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      await runSql(old, `PRAGMA user_version = ${version}`);
    }
    const insert = (id: string, tmdbId: number, payload: string): Promise<unknown> =>
      old.execute({
        sql: "INSERT INTO titles (id, kind, tmdb_id, origin, payload, fetched_at) VALUES (?, 'movie', ?, 'tmdb', ?, 9)",
        args: [id, tmdbId, payload],
      });
    await insert("movie-1", 1, JSON.stringify({ shape: "detail", imdbId: "tt1", omdb: { fetchedAt: 1 } }));
    await insert("movie-2", 2, JSON.stringify({ shape: "detail", imdbId: "tt2" }));
    old.close();

    const store = await createStore(file);
    assert.equal((await store.titles.find("movie", 1))?.fetchedAt, 9);
    // staleBefore 5: both TMDB details are fresh; with OMDb on, the one with no block is queued, the old block (1 < 5) too.
    assert.deepEqual(await store.titles.queue.pendingDetails(5, 3, false), []);
    assert.deepEqual((await store.titles.queue.pendingDetails(5, 3, true)).map((p) => p.id).sort(), ["movie-1", "movie-2"]);
    await store.titles.queue.setOmdbFailure("movie-2", 6);
    assert.deepEqual((await store.titles.queue.pendingDetails(5, 3, true)).map((p) => p.id), ["movie-1"], "a recent miss waits");
    await store.titles.queue.setOmdbFailure("movie-2", null);
    store.close();

    const db = await openTestDatabase(file);
    try {
      assert.equal((await queryRow(db, "PRAGMA user_version"))?.user_version, 31);
      const column = (await queryRows(db, "PRAGMA table_info(titles)")).find((c) => c.name === "omdb_failed_at");
      assert.deepEqual([column?.type, column?.notnull], ["INTEGER", 0]);
      assert.deepEqual(await queryRows(db, "SELECT omdb_failed_at FROM titles"),
        [{ omdb_failed_at: null }, { omdb_failed_at: null }]);
      assert.deepEqual(await queryRows(db, "PRAGMA foreign_key_check"), []);
    } finally {
      db.close();
    }
  } finally {
    removeDir(dir);
  }
});