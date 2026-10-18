// Migration 020 (deleted titles): it applies on top of the latest earlier migration (018 here; 019 is built elsewhere),
// keeps the stored titles, and makes the table a restore reads and writes through the store.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/store/store.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

/** A database as migrations 001 to 018 left it, with one stored TMDB title. */
function database018(dir: string): string {
  const file = path.join(dir, "admin.db");
  const db = new DatabaseSync(file);
  try {
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 18) continue;
      db.exec(readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      db.exec(`PRAGMA user_version = ${version}`);
    }
    db.prepare("INSERT INTO titles (id, kind, tmdb_id, origin, payload, fetched_at) VALUES (?, ?, ?, 'tmdb', ?, ?)")
      .run("movie-603", "movie", 603, JSON.stringify({ title: "The Matrix" }), 5);
  } finally {
    db.close();
  }
  return file;
}

test("020 applies on an 018 database: the title stays, the table is empty, and a record round-trips", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-deleted-titles-"));
  try {
    const file = database018(dir);
    const store = createStore(file);
    assert.equal(store.titles.find("movie", 603)?.fetchedAt, 5);
    assert.deepEqual(store.deletedTitles.list(), []);
    store.deletedTitles.record("movie", 603, "The Matrix", 9);
    store.deletedTitles.record("movie", 603, undefined, 10);
    store.deletedTitles.record("tv", 603, undefined, 8);
    assert.equal(store.deletedTitles.has("movie", 603), true);
    assert.deepEqual(store.deletedTitles.list().map((r) => [r.kind, r.title, r.deletedAt]), [
      ["movie", "The Matrix", 10], ["tv", undefined, 8],
    ], "one row per kind and id; a repeat keeps the known title");
    assert.equal(store.deletedTitles.restore("movie", 603), true);
    assert.equal(store.deletedTitles.restore("movie", 603), false);
    store.close();
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const version = db.prepare("PRAGMA user_version").get();
      assert.equal(Number(Object.values(version ?? {})[0]), 27);
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
