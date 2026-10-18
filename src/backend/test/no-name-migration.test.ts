// Migration 021 (accounts have no name, owner 2026-10-17): the column goes, every account, hash, counter, session
// version, security question, refresh token and the per-account interface state survive, and a login still works.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/store/store.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

/** A database as migrations 001 to 020 left it, with two accounts that carry a name. */
function database020(dir: string): string {
  const file = path.join(dir, "admin.db");
  const db = new DatabaseSync(file);
  try {
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 20) continue;
      db.exec(readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      db.exec(`PRAGMA user_version = ${version}`);
    }
    const account = db.prepare(`INSERT INTO admin_accounts (id, username, username_key, name, password_hash, disabled,
      session_version, failed_sign_ins, locked_until, created_at, updated_at, last_sign_in_at, security_question,
      security_answer_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    account.run("acct_a", "Boss", "boss", "The Boss", "scrypt$hash-a", 0, 4, 2, null, 1, 2, 3, 5, "scrypt$answer");
    account.run("acct_b", "ed", "ed", "Edward", "scrypt$hash-b", 1, 1, 0, 99, 5, 6, null, null, null);
    db.prepare(`INSERT INTO refresh_tokens (id, account_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`)
      .run("rt_1", "acct_a", "hash-1", 1, 9_999_999_999_999);
    db.prepare("INSERT INTO admin_ui_state (account_id, settings, shell, updated_at) VALUES (?, ?, ?, ?)")
      .run("acct_a", "{}", "{}", 1);
  } finally {
    db.close();
  }
  return file;
}

test("021 drops the account name and keeps every account, hash, session and security question", () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-noname-"));
  try {
    const file = database020(dataDir);
    const store = createStore(file);
    try {
      const rows = store.accounts.list();
      assert.deepEqual(rows.map((a) => [a.account.id, a.account.username, a.account.disabled]), [
        ["acct_a", "Boss", false],
        ["acct_b", "ed", true],
      ]);
      assert.equal(rows.some((a) => "name" in a.account), false);
      const boss = store.accounts.findByUsername("BOSS");
      assert.deepEqual(
        [boss?.passwordHash, boss?.sessionVersion, boss?.securityQuestion, boss?.securityAnswerHash],
        ["scrypt$hash-a", 4, 5, "scrypt$answer"],
      );
      assert.equal(boss?.account.securityQuestionSet, true);
      assert.equal(store.refreshTokens.findByHash("hash-1")?.accountId, "acct_a");
      store.accounts.insert({ id: "acct_c", username: "New", passwordHash: "scrypt$c", disabled: false }, 10);
      assert.equal(store.accounts.count(), 3);
    } finally {
      store.close();
    }
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const columns = db.prepare("PRAGMA table_info(admin_accounts)").all().map((r) => String(r.name));
      assert.equal(columns.includes("name"), false);
      assert.deepEqual({ ...db.prepare("PRAGMA user_version").get() }, { user_version: 24 });
      assert.equal(Object.values(db.prepare("SELECT COUNT(*) AS n FROM admin_ui_state").get() ?? {})[0], 1);
    } finally {
      db.close();
    }
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
