// Migration 018 (docs/40 section 3.1): it applies on a 017 database with accounts, the version reads 18, the existing
// accounts have no question, and an 018 database is refused by a program that knows only 017.
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

/** A database as migrations 001 to 017 left it, with one account. */
function database017(dataDir: string): string {
  const file = path.join(dataDir, DATABASE_FILE_NAME);
  const db = new DatabaseSync(file);
  try {
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 17) continue;
      db.exec(readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      db.exec(`PRAGMA user_version = ${version}`);
    }
    db.exec(`INSERT INTO admin_accounts (id, email, email_key, name, password_hash, disabled, session_version,
        failed_sign_ins, locked_until, created_at, updated_at, last_sign_in_at)
      VALUES ('acct_a', 'Boss@Example.test', 'boss@example.test', 'Boss', 'scrypt$hash-a', 0, 2, 1, NULL, 10, 11, 12)`);
  } finally {
    db.close();
  }
  return file;
}

function readOnly<T>(file: string, read: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return read(db);
  } finally {
    db.close();
  }
}

function inFolder(work: (dataDir: string) => void): void {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-reset-migration-"));
  try {
    work(dataDir);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
}

test("018 applies on a 017 database: version 18, the existing account has no question, the attempt table exists", () => {
  inFolder((dataDir) => {
    const file = database017(dataDir);
    const store = createStore(file);
    const stored = store.accounts.find("acct_a");
    assert.deepEqual(
      [stored?.securityQuestion, stored?.securityAnswerHash, stored?.account.securityQuestionSet],
      [null, null, false],
    );
    assert.equal(stored?.passwordHash, "scrypt$hash-a");
    assert.equal(store.resetAttempts.find("boss@example.test"), undefined);
    store.close();
    readOnly(file, (db) => {
      assert.deepEqual({ ...db.prepare("PRAGMA user_version").get() }, { user_version: 18 });
      const columns = db.prepare("PRAGMA table_info(reset_attempts)").all().map((row) => String(row.name));
      assert.deepEqual(columns, ["email_key", "failed", "locked_until"]);
    });
  });
});

test("the question column accepts 1 to 8 only", () => {
  inFolder((dataDir) => {
    const file = database017(dataDir);
    const store = createStore(file);
    store.accounts.setSecurityQuestion("acct_a", 8, "scrypt$answer", 20);
    assert.equal(store.accounts.find("acct_a")?.account.securityQuestionSet, true);
    assert.throws(() => store.accounts.setSecurityQuestion("acct_a", 9, "scrypt$answer", 21));
    store.close();
  });
});

test("an 018 database opens again, and a program that knows only 017 refuses it", () => {
  inFolder((dataDir) => {
    const file = database017(dataDir);
    createStore(file).close();
    createStore(file).close();
    assert.equal(readOnly(file, (db) => Number(Object.values(db.prepare("PRAGMA user_version").get() ?? {})[0])), 18);
    // A 017 program sees an 018 database exactly as this program sees a 019 one: newer than its newest migration.
    const db = new DatabaseSync(file);
    try {
      db.exec("PRAGMA user_version = 19");
    } finally {
      db.close();
    }
    assert.throws(
      () => createStore(file),
      (error: unknown) => error instanceof AppError && error.code === ERRORS.storeNewerSchema.code,
    );
  });
});
