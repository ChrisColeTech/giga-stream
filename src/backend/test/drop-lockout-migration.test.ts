// Migration 023 (no sign-in rate limit or lockout, owner 2026-10-18): the two lockout columns and the reset attempt table
// go; every account, hash, security question, refresh token and per-account interface state survives.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/store/store.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

/** A database as migrations 001 to 022 left it, with a locked account that holds a security question. */
function database022(dir: string): string {
  const file = path.join(dir, "admin.db");
  const db = new DatabaseSync(file);
  try {
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 22) continue;
      db.exec(readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      db.exec(`PRAGMA user_version = ${version}`);
    }
    db.prepare(`INSERT INTO admin_accounts (id, username, username_key, password_hash, disabled, session_version,
      failed_sign_ins, locked_until, created_at, updated_at, last_sign_in_at, security_question, security_answer_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run("acct_a", "Boss", "boss", "scrypt$hash-a", 0, 4, 3, 99, 1, 2, 3, 5, "scrypt$answer");
    db.prepare("INSERT INTO reset_attempts (username_key, failed, locked_until) VALUES ('boss', 2, NULL)").run();
    db.prepare(`INSERT INTO refresh_tokens (id, account_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`)
      .run("rt_1", "acct_a", "hash-1", 1, 9_999_999_999_999);
    db.prepare("INSERT INTO admin_ui_state (account_id, settings, shell, updated_at) VALUES (?, ?, ?, ?)")
      .run("acct_a", "{}", "{}", 1);
  } finally {
    db.close();
  }
  return file;
}

test("023 drops the lockout columns and the attempt table and keeps every account, hash, token and question", () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-nolockout-"));
  try {
    const file = database022(dataDir);
    const store = createStore(file);
    try {
      const boss = store.accounts.findByUsername("BOSS");
      assert.deepEqual(
        [boss?.account.id, boss?.account.username, boss?.passwordHash, boss?.sessionVersion],
        ["acct_a", "Boss", "scrypt$hash-a", 4],
      );
      assert.deepEqual([boss?.securityQuestion, boss?.securityAnswerHash], [5, "scrypt$answer"]);
      assert.equal(boss?.account.lastSignInAt, 3);
      assert.equal(store.refreshTokens.findByHash("hash-1")?.accountId, "acct_a");
      store.accounts.recordSignIn("acct_a", 50);
      assert.equal(store.accounts.find("acct_a")?.account.lastSignInAt, 50);
    } finally {
      store.close();
    }
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const columns = db.prepare("PRAGMA table_info(admin_accounts)").all().map((r) => String(r.name));
      assert.equal(columns.includes("failed_sign_ins") || columns.includes("locked_until"), false);
      assert.deepEqual({ ...db.prepare("PRAGMA user_version").get() }, { user_version: 28 });
      assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
      const table = "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'reset_attempts'";
      assert.equal(db.prepare(table).get(), undefined);
      assert.equal(Object.values(db.prepare("SELECT COUNT(*) AS n FROM admin_ui_state").get() ?? {})[0], 1);
    } finally {
      db.close();
    }
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
