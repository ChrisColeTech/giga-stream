// Migration 030 (docs/56 decisions 7-8; docs/57 decision 8): stale catalog keys are normalized, omitted legacy Kind
// remains Movies, and old appearance values are rewritten before strict application schemas parse them.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/store/store.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

test("030 rewrites legacy settings and normalizes every catalog config shape", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "giga-consistency-migration-"));
  const file = path.join(dir, "admin.db");
  try {
    const old = new DatabaseSync(file);
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 29) continue;
      old.exec(readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      old.exec(`PRAGMA user_version = ${version}`);
    }
    old.exec(`INSERT INTO admin_accounts
      (id, username, username_key, password_hash, disabled, session_version, created_at, updated_at)
      VALUES ('acct', 'boss', 'boss', 'hash', 0, 1, 1, 1)`);
    old.prepare("INSERT INTO admin_ui_state (account_id, settings, shell, updated_at) VALUES (?, ?, '{}', 1)")
      .run("acct", '{"theme":"system","themeAccent":"amber","reducedMotion":"system","uiZoom":1}');
    const insert = old.prepare(
      "INSERT INTO sync_jobs (name, type, enabled, schedule, config, created_at) VALUES (?, 'catalog', 1, 'off', ?, 1)",
    );
    insert.run("Fill", '{"scope":"discover","kind":"tv","pages":7}');
    insert.run("Update", '{"scope":"recent","kind":"movie","pages":1}');
    insert.run("Legacy", '{"scope":"trending","pages":2}');
    insert.run("All", '{"scope":"popular","kind":"all","pages":3}');
    old.close();

    const store = createStore(file);
    assert.deepEqual(store.jobs.list().filter((job) => job.type === "catalog").map((job) => job.config), [
      { scope: "discover" }, { scope: "recent" },
      { scope: "trending", kind: "movie", pages: 2 },
      { scope: "popular", kind: "all", pages: 3 },
    ]);
    assert.deepEqual(JSON.parse(store.uiState.find("acct")?.settings ?? "null"), {
      theme: "dark", themeAccent: "amber", reducedMotion: "off", uiZoom: 1,
    });
    store.close();
    const migrated = new DatabaseSync(file, { readOnly: true });
    assert.equal(migrated.prepare("PRAGMA user_version").get()?.user_version, 30);
    migrated.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
