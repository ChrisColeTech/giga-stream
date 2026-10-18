// Migration 027 (docs/11 section 7.3): the nullable `omdb_failed_at` on `titles`. Forward-only; every stored title is kept.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/store/store.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

test("027 lands on a version-26 database: the titles are kept, omdb_failed_at is empty and nullable, and an OMDb block is queued", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-omdb-migration-"));
  try {
    const file = path.join(dir, "admin.db");
    const old = new DatabaseSync(file);
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 26) continue;
      old.exec(readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      old.exec(`PRAGMA user_version = ${version}`);
    }
    const detail = JSON.stringify({ shape: "detail", imdbId: "tt1", omdb: { fetchedAt: 1 } });
    old.prepare("INSERT INTO titles (id, kind, tmdb_id, origin, payload, fetched_at) VALUES ('movie-1', 'movie', 1, 'tmdb', ?, 9)").run(detail);
    old.prepare("INSERT INTO titles (id, kind, tmdb_id, origin, payload, fetched_at) VALUES ('movie-2', 'movie', 2, 'tmdb', ?, 9)")
      .run(JSON.stringify({ shape: "detail", imdbId: "tt2" }));
    old.close();

    const store = createStore(file);
    assert.equal(store.titles.find("movie", 1)?.fetchedAt, 9);
    // staleBefore 5: both TMDB details are fresh; with OMDb on, the one with no block is queued, the old block (1 < 5) too.
    assert.deepEqual(store.titles.queue.pendingDetails(5, 3, false), []);
    assert.deepEqual(store.titles.queue.pendingDetails(5, 3, true).map((p) => p.id).sort(), ["movie-1", "movie-2"]);
    store.titles.queue.setOmdbFailure("movie-2", 6);
    assert.deepEqual(store.titles.queue.pendingDetails(5, 3, true).map((p) => p.id), ["movie-1"], "a recent miss waits");
    store.titles.queue.setOmdbFailure("movie-2", null);
    store.close();

    const db = new DatabaseSync(file, { readOnly: true });
    try {
      assert.equal(db.prepare("PRAGMA user_version").get()?.user_version, 28);
      const column = db.prepare("PRAGMA table_info(titles)").all().find((c) => c.name === "omdb_failed_at");
      assert.deepEqual([column?.type, column?.notnull], ["INTEGER", 0]);
      assert.deepEqual(db.prepare("SELECT omdb_failed_at FROM titles").all().map((r) => ({ ...r })),
        [{ omdb_failed_at: null }, { omdb_failed_at: null }]);
      assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
