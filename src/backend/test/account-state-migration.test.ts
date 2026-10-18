// Migration 017 (docs/29 section 18, B1): it lands on a 016 database (018 to 022 follow, so the version reads 22), a
// current database opens, and a database from a newer program is refused by the existing rule.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { AppError, ERRORS } from "../src/constants/errors.js";
import { DATABASE_FILE_NAME } from "../src/constants/deployment.js";
import { createStore } from "../src/store/store.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

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

/** A database as it was at `version`: the numbered migrations up to it, run in order (022 rebuilds tables, so it is not undone). */
function databaseAt(file: string, version: number): void {
  const db = new DatabaseSync(file);
  try {
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const number = Number(name.slice(0, 3));
      if (number > version) continue;
      db.exec(readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      db.exec(`PRAGMA user_version = ${number}`);
    }
  } finally {
    db.close();
  }
}

test("migration 017 lands on a 016 database: the table appears and the later migrations bring it to 25", () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-ui-state-migration-"));
  const file = path.join(dataDir, DATABASE_FILE_NAME);
  try {
    databaseAt(file, 16);
    assert.equal(versionOf(file), 16);
    assert.equal(tableExists(file, "admin_ui_state"), false);

    createStore(file).close();

    assert.equal(versionOf(file), 25);
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
    assert.equal(versionOf(file), 25);

    reshape(file, [], 26);
    assert.throws(
      () => createStore(file),
      (error: unknown) => error instanceof AppError && error.code === ERRORS.storeNewerSchema.code,
    );
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
