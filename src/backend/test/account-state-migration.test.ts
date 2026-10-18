// Migration 017 (docs/29 section 18, B1): it lands on a 016 database (018 to 021 follow, so the version reads 21), a
// current database opens, and a database from a newer program is refused by the existing rule.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { AppError, ERRORS } from "../src/constants/errors.js";
import { DATABASE_FILE_NAME } from "../src/constants/deployment.js";
import { createStore } from "../src/store/store.js";

function versionOf(file: string): number {
  const db = new DatabaseSync(file);
  try {
    const row = db.prepare("PRAGMA user_version").get();
    return Number(row === undefined ? -1 : Object.values(row)[0]);
  } finally {
    db.close();
  }
}

function tableExists(file: string, name: string): boolean {
  const db = new DatabaseSync(file);
  try {
    return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== undefined;
  } finally {
    db.close();
  }
}

/** Sets the stored shape of a database by hand: a database one version behind lacks the state table. */
function reshape(file: string, sql: string[], version: number): void {
  const db = new DatabaseSync(file);
  try {
    for (const statement of sql) db.exec(statement);
    db.exec(`PRAGMA user_version = ${version}`);
  } finally {
    db.close();
  }
}

/** Undoes migration 021 (no account name): the column comes back, empty. */
const UNDO_021 = ["ALTER TABLE admin_accounts ADD COLUMN name TEXT NOT NULL DEFAULT ''"];

/** Undoes migration 019 (username), so a database can be set back to an older version. */
const UNDO_019 = [
  "ALTER TABLE admin_accounts RENAME COLUMN username TO email",
  "ALTER TABLE admin_accounts RENAME COLUMN username_key TO email_key",
  "ALTER TABLE audit_log RENAME COLUMN actor_username TO actor_email",
  "ALTER TABLE reset_attempts RENAME COLUMN username_key TO email_key",
];

/** Undoes migration 018 (security questions), so a database can be set back to an older version. */
const UNDO_018 = [
  "DROP TABLE reset_attempts",
  "ALTER TABLE admin_accounts DROP COLUMN security_answer_hash",
  "ALTER TABLE admin_accounts DROP COLUMN security_question",
];

test("migration 017 lands on a 016 database: the table appears and the later migrations bring it to 21", () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-ui-state-migration-"));
  const file = path.join(dataDir, DATABASE_FILE_NAME);
  try {
    createStore(file).close();
    assert.equal(versionOf(file), 21);
    reshape(file, ["DROP TABLE deleted_titles", ...UNDO_021, ...UNDO_019, ...UNDO_018, "DROP TABLE admin_ui_state"], 16);
    assert.equal(tableExists(file, "admin_ui_state"), false);

    createStore(file).close();

    assert.equal(versionOf(file), 21);
    assert.equal(tableExists(file, "admin_ui_state"), true);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("a current database opens again, and a database from a newer program is refused", () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-ui-state-newer-"));
  const file = path.join(dataDir, DATABASE_FILE_NAME);
  try {
    createStore(file).close();
    createStore(file).close();
    assert.equal(versionOf(file), 21);

    reshape(file, [], 22);
    assert.throws(
      () => createStore(file),
      (error: unknown) => error instanceof AppError && error.code === ERRORS.storeNewerSchema.code,
    );
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
