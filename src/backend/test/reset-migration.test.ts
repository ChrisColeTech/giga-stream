// Migration 018 (docs/40 section 3.1): it applies on a 017 database with accounts, the existing accounts have no
// question, and a database newer than the newest migration is refused. With 019 (username) the version reads 19.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { Client } from "@libsql/client";

import { AppError, ERRORS } from "../src/constants/errors.js";
import { DATABASE_FILE_NAME } from "../src/constants/deployment.js";
import { createStore } from "../src/store/store.js";
import { removeDir, openTestDatabase, queryRow, queryRows, runSql } from "./db-kit.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

/** A database as migrations 001 to 017 left it, with one account. */
async function database017(dataDir: string): Promise<string> {
  const file = path.join(dataDir, DATABASE_FILE_NAME);
  const db = await openTestDatabase(file);
  try {
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 17) continue;
      await runSql(db, readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      await runSql(db, `PRAGMA user_version = ${version}`);
    }
    await runSql(db, `INSERT INTO admin_accounts (id, email, email_key, name, password_hash, disabled, session_version,
        failed_sign_ins, locked_until, created_at, updated_at, last_sign_in_at)
      VALUES ('acct_a', 'Boss@Example.test', 'boss@example.test', 'Boss', 'scrypt$hash-a', 0, 2, 1, NULL, 10, 11, 12)`);
  } finally {
    db.close();
  }
  return file;
}

async function readOnly<T>(file: string, read: (db: Client) => Promise<T>): Promise<T> {
  const db = await openTestDatabase(file);
  try {
    return await read(db);
  } finally {
    db.close();
  }
}

async function inFolder(work: (dataDir: string) => Promise<void>): Promise<void> {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-reset-migration-"));
  try {
    await work(dataDir);
  } finally {
    removeDir(dataDir);
  }
}

test("018 applies on a 017 database: the existing account has no question, the attempt table is gone after 023", async () => {
  await inFolder(async (dataDir) => {
    const file = await database017(dataDir);
    const store = await createStore(file);
    const stored = await store.accounts.find("acct_a");
    assert.deepEqual(
      [stored?.securityQuestion, stored?.securityAnswerHash, stored?.account.securityQuestionSet],
      [null, null, false],
    );
    assert.equal(stored?.passwordHash, "scrypt$hash-a");
    store.close();
    await readOnly(file, async (db) => {
      assert.deepEqual(await queryRows(db, "PRAGMA user_version"), [{ user_version: 30 }]);
      assert.deepEqual(await queryRows(db, "PRAGMA table_info(reset_attempts)"), [], "023 drops the attempt table");
    });
  });
});

test("the question column accepts 1 to 8 only", async () => {
  await inFolder(async (dataDir) => {
    const file = await database017(dataDir);
    const store = await createStore(file);
    await store.accounts.setSecurityQuestion("acct_a", 8, "scrypt$answer", 20);
    assert.equal((await store.accounts.find("acct_a"))?.account.securityQuestionSet, true);
    await assert.rejects(() => store.accounts.setSecurityQuestion("acct_a", 9, "scrypt$answer", 21));
    store.close();
  });
});

test("a migrated database opens again, and a newer one than the newest migration is refused", async () => {
  await inFolder(async (dataDir) => {
    const file = await database017(dataDir);
    (await createStore(file)).close();
    (await createStore(file)).close();
    assert.equal(
      await readOnly(file, async (db) => Number(Object.values((await queryRow(db, "PRAGMA user_version")) ?? {})[0])),
      30,
    );
    // A 017 program sees an 018 database exactly as this program sees a 030 one: newer than its newest migration.
    const db = await openTestDatabase(file);
    try {
      await runSql(db, "PRAGMA user_version = 31");
    } finally {
      db.close();
    }
    await assert.rejects(
      () => createStore(file),
      (error: unknown) => error instanceof AppError && error.code === ERRORS.storeNewerSchema.code,
    );
  });
});