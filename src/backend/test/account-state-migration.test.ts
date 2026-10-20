// Migration 017 (docs/29 section 18, B1): it lands on a 016 database (018 to 022 follow, so the version reads 22), a
// current database opens, and a database from a newer program is refused by the existing rule.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { AppError, ERRORS } from "../src/constants/errors.js";
import { DATABASE_FILE_NAME } from "../src/constants/deployment.js";
import { createStore } from "../src/store/store.js";
import { removeDir, openTestDatabase, queryRow, runSql } from "./db-kit.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

async function versionOf(file: string): Promise<number> {
  const db = await openTestDatabase(file);
  try {
    const row = await queryRow(db, "PRAGMA user_version");
    return Number(row === undefined ? -1 : Object.values(row)[0]);
  } finally {
    db.close();
  }
}

async function tableExists(file: string, name: string): Promise<boolean> {
  const db = await openTestDatabase(file);
  try {
    return (await queryRow(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [name])) !== undefined;
  } finally {
    db.close();
  }
}

/** Sets the stored shape of a database by hand: a database one version behind lacks the state table. */
async function reshape(file: string, sql: string[], version: number): Promise<void> {
  const db = await openTestDatabase(file);
  try {
    for (const statement of sql) await runSql(db, statement);
    await runSql(db, `PRAGMA user_version = ${version}`);
  } finally {
    db.close();
  }
}

/** A database as it was at `version`: the numbered migrations up to it, run in order (022 rebuilds tables, so it is not undone). */
async function databaseAt(file: string, version: number): Promise<void> {
  const db = await openTestDatabase(file);
  try {
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const number = Number(name.slice(0, 3));
      if (number > version) continue;
      await runSql(db, readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      await runSql(db, `PRAGMA user_version = ${number}`);
    }
  } finally {
    db.close();
  }
}

test("migration 017 lands on a 016 database: the table appears and the later migrations bring it to the newest", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-ui-state-migration-"));
  const file = path.join(dataDir, DATABASE_FILE_NAME);
  try {
    await databaseAt(file, 16);
    assert.equal(await versionOf(file), 16);
    assert.equal(await tableExists(file, "admin_ui_state"), false);

    (await createStore(file)).close();

    assert.equal(await versionOf(file), 32);
    assert.equal(await tableExists(file, "admin_ui_state"), true);
  } finally {
    removeDir(dataDir);
  }
});

test("a current database opens again, and a database from a newer program is refused", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-ui-state-newer-"));
  const file = path.join(dataDir, DATABASE_FILE_NAME);
  try {
    (await createStore(file)).close();
    (await createStore(file)).close();
    assert.equal(await versionOf(file), 32);

    await reshape(file, [], 33);
    await assert.rejects(
      () => createStore(file),
      (error: unknown) => error instanceof AppError && error.code === ERRORS.storeNewerSchema.code,
    );
  } finally {
    removeDir(dataDir);
  }
});