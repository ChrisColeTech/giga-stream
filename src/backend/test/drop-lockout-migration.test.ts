// Migration 023 (no sign-in rate limit or lockout, owner 2026-10-18): the two lockout columns and the reset attempt table
// go; every account, hash, security question, refresh token and per-account interface state survives.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/store/store.js";
import { removeDir, openTestDatabase, queryRow, queryRows, runSql } from "./db-kit.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

/** A database as migrations 001 to 022 left it, with a locked account that holds a security question. */
async function database022(dir: string): Promise<string> {
  const file = path.join(dir, "admin.db");
  const db = await openTestDatabase(file);
  try {
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 22) continue;
      await runSql(db, readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      await runSql(db, `PRAGMA user_version = ${version}`);
    }
    await db.execute({
      sql: `INSERT INTO admin_accounts (id, username, username_key, password_hash, disabled, session_version,
        failed_sign_ins, locked_until, created_at, updated_at, last_sign_in_at, security_question, security_answer_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ["acct_a", "Boss", "boss", "scrypt$hash-a", 0, 4, 3, 99, 1, 2, 3, 5, "scrypt$answer"],
    });
    await runSql(db, "INSERT INTO reset_attempts (username_key, failed, locked_until) VALUES ('boss', 2, NULL)");
    await db.execute({
      sql: "INSERT INTO refresh_tokens (id, account_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
      args: ["rt_1", "acct_a", "hash-1", 1, 9_999_999_999_999],
    });
    await db.execute({
      sql: "INSERT INTO admin_ui_state (account_id, settings, shell, updated_at) VALUES (?, ?, ?, ?)",
      args: ["acct_a", "{}", "{}", 1],
    });
  } finally {
    db.close();
  }
  return file;
}

test("023 drops the lockout columns and the attempt table and keeps every account, hash, token and question", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-nolockout-"));
  try {
    const file = await database022(dataDir);
    const store = await createStore(file);
    try {
      const boss = await store.accounts.findByUsername("BOSS");
      assert.deepEqual(
        [boss?.account.id, boss?.account.username, boss?.passwordHash, boss?.sessionVersion],
        ["acct_a", "Boss", "scrypt$hash-a", 4],
      );
      assert.deepEqual([boss?.securityQuestion, boss?.securityAnswerHash], [5, "scrypt$answer"]);
      assert.equal(boss?.account.lastSignInAt, 3);
      assert.equal((await store.refreshTokens.findByHash("hash-1"))?.accountId, "acct_a");
      await store.accounts.recordSignIn("acct_a", 50);
      assert.equal((await store.accounts.find("acct_a"))?.account.lastSignInAt, 50);
    } finally {
      store.close();
    }
    const db = await openTestDatabase(file);
    try {
      const columns = (await queryRows(db, "PRAGMA table_info(admin_accounts)")).map((r) => String(r.name));
      assert.equal(columns.includes("failed_sign_ins") || columns.includes("locked_until"), false);
      assert.deepEqual(await queryRows(db, "PRAGMA user_version"), [{ user_version: 32 }]);
      assert.deepEqual(await queryRows(db, "PRAGMA foreign_key_check"), []);
      const table = "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'reset_attempts'";
      assert.equal(await queryRow(db, table), undefined);
      assert.equal(Object.values((await queryRow(db, "SELECT COUNT(*) AS n FROM admin_ui_state")) ?? {})[0], 1);
    } finally {
      db.close();
    }
  } finally {
    removeDir(dataDir);
  }
});