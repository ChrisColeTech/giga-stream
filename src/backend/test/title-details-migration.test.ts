// Migration 026 (docs/47 sections 3.1 and 3.4): the details bookkeeping columns on `titles` (nullable, so every stored
// title is kept as it was) and the stored genre dictionary. Forward-only.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/store/store.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

test("026 lands on a version-25 database: the titles are kept, the new columns are empty, the genre table is there", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-details-migration-"));
  try {
    const file = path.join(dir, "admin.db");
    const old = new DatabaseSync(file);
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 25) continue;
      old.exec(readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      old.exec(`PRAGMA user_version = ${version}`);
    }
    old.prepare("INSERT INTO titles (id, kind, tmdb_id, origin, payload, fetched_at) VALUES ('movie-1', 'movie', 1, 'tmdb', '{\"shape\":\"list\"}', 5)").run();
    old.close();

    const store = createStore(file);
    assert.equal(store.titles.find("movie", 1)?.fetchedAt, 5);
    assert.deepEqual(store.titles.genres("movie"), []);
    store.titles.replaceGenres("movie", [{ id: 18, name: "Drama" }]);
    assert.deepEqual(store.titles.genres("movie"), [{ id: 18, name: "Drama" }]);
    store.close();

    const db = new DatabaseSync(file, { readOnly: true });
    try {
      assert.equal(db.prepare("PRAGMA user_version").get()?.user_version, 28);
      const columns = db.prepare("PRAGMA table_info(titles)").all().filter((c) => String(c.name).startsWith("detail_"));
      assert.deepEqual(columns.map((c) => [c.name, c.notnull]), [["detail_failed_at", 0], ["detail_failures", 0]]);
      assert.deepEqual(db.prepare("SELECT detail_failed_at, detail_failures FROM titles").all().map((r) => ({ ...r })),
        [{ detail_failed_at: null, detail_failures: null }]);
      assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
