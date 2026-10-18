import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { openDatabase } from "../src/store/database.js";
import { migrate, readSchemaVersion } from "../src/store/migrate.js";

/** The exact column set of the cache tables (docs/46 section B). Adding a column means editing this test and the docs. */
const COLUMNS: Record<string, string[]> = {
  cache_state: ["attempted_at", "dataset", "error_code", "revision", "run", "source_key", "synced_at"],
  cached_channels: ["category", "id", "logo_url", "name", "number", "position", "revision", "stream_url"],
  cached_titles: [
    "backdrop_url", "cast_json", "detail_at", "id", "in_catalog", "kind", "plot", "popularity", "poster_url",
    "rating", "runtime_ms", "seasons_json", "seen_run", "title", "year",
  ],
  cached_title_genres: ["genre", "title_id"],
  cached_genres: ["id", "kind", "name"],
};

function columnsOf(db: DatabaseSync, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name).sort();
}

test("the cache tables have exactly the documented columns: no provider, sources, title stream address or token", () => {
  const db = openDatabase(":memory:");
  for (const [table, columns] of Object.entries(COLUMNS)) assert.deepEqual(columnsOf(db, table), columns, table);
  const all = Object.values(COLUMNS).flat();
  assert.deepEqual(all.filter((name) => /provider|sources|token|secret|password|auth/.test(name)), []);
  assert.deepEqual(columnsOf(db, "cached_titles").filter((name) => name.includes("stream")), []);
  db.close();
});

test("a version 5 database upgrades to 7 and keeps everything it held", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-migrate-"));
  const file = path.join(dir, "v5.db");
  const old = new DatabaseSync(file);
  const migrations = new URL("../src/store/migrations/", import.meta.url);
  for (const name of ["001-init", "002-drop-synced-catalog", "003-settings-admin-url", "004-collection-type", "005-local-file-titles"]) {
    old.exec(readFileSync(new URL(`${name}.sql`, migrations), "utf-8"));
  }
  old.exec("PRAGMA user_version = 5");
  old.exec("INSERT INTO settings (key, value, updated_at) VALUES ('adminUrl', '\"http://127.0.0.1:9\"', 1)");
  old.exec("INSERT INTO favorites (item_kind, item_id, added_at) VALUES ('title', 'movie-1', 2)");
  old.exec("INSERT INTO channel_state (id, last_channel_id) VALUES (1, 'fx-news')");
  assert.equal(readSchemaVersion(old), 5);
  assert.equal(migrate(old), 7);
  assert.equal(readSchemaVersion(old), 7);
  const one = (sql: string): unknown => ({ ...old.prepare(sql).get() });
  assert.deepEqual(one("SELECT value FROM settings WHERE key = 'adminUrl'"), { value: '"http://127.0.0.1:9"' });
  assert.deepEqual(one("SELECT item_id FROM favorites"), { item_id: "movie-1" });
  assert.deepEqual(one("SELECT last_channel_id FROM channel_state"), { last_channel_id: "fx-news" });
  assert.deepEqual(one("SELECT COUNT(*) AS n FROM cache_state"), { n: 0 });
  old.close();
  rmSync(dir, { recursive: true, force: true });
});
