// Migration 021 (accounts have no name, owner 2026-10-17): the column goes, every account, hash, counter, session
// version, security question, refresh token and the per-account interface state survive, and a login still works.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/store/store.js";
import { removeDir, openTestDatabase, queryRow, queryRows, runSql } from "./db-kit.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

/** A database as migrations 001 to 020 left it, with two accounts that carry a name. */
async function database020(dir: string): Promise<string> {
  const file = path.join(dir, "admin.db");
  const db = await openTestDatabase(file);
  try {
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 20) continue;
      await runSql(db, readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      await runSql(db, `PRAGMA user_version = ${version}`);
    }
    const account = (
      id: string, username: string, key: string, name: string, hash: string, disabled: number, version: number,
      failed: number, locked: number | null, createdAt: number, updatedAt: number, signedIn: number | null,
      question: number | null, answer: string | null,
    ): Promise<unknown> =>
      db.execute({
        sql: `INSERT INTO admin_accounts (id, username, username_key, name, password_hash, disabled,
          session_version, failed_sign_ins, locked_until, created_at, updated_at, last_sign_in_at, security_question,
          security_answer_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, username, key, name, hash, disabled, version, failed, locked, createdAt, updatedAt, signedIn, question, answer],
      });
    await account("acct_a", "Boss", "boss", "The Boss", "scrypt$hash-a", 0, 4, 2, null, 1, 2, 3, 5, "scrypt$answer");
    await account("acct_b", "ed", "ed", "Edward", "scrypt$hash-b", 1, 1, 0, 99, 5, 6, null, null, null);
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

test("021 drops the account name and keeps every account, hash, session and security question", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-noname-"));
  try {
    const file = await database020(dataDir);
    const store = await createStore(file);
    try {
      const rows = await store.accounts.list();
      assert.deepEqual(rows.map((a) => [a.account.id, a.account.username, a.account.disabled]), [
        ["acct_a", "Boss", false],
        ["acct_b", "ed", true],
      ]);
      assert.equal(rows.some((a) => "name" in a.account), false);
      const boss = await store.accounts.findByUsername("BOSS");
      assert.deepEqual(
        [boss?.passwordHash, boss?.sessionVersion, boss?.securityQuestion, boss?.securityAnswerHash],
        ["scrypt$hash-a", 4, 5, "scrypt$answer"],
      );
      assert.equal(boss?.account.securityQuestionSet, true);
      assert.equal((await store.refreshTokens.findByHash("hash-1"))?.accountId, "acct_a");
      await store.accounts.insert({ id: "acct_c", username: "New", passwordHash: "scrypt$c", disabled: false }, 10);
      assert.equal(await store.accounts.count(), 3);
    } finally {
      store.close();
    }
    const db = await openTestDatabase(file);
    try {
      const columns = (await queryRows(db, "PRAGMA table_info(admin_accounts)")).map((r) => String(r.name));
      assert.equal(columns.includes("name"), false);
      assert.deepEqual(await queryRows(db, "PRAGMA user_version"), [{ user_version: 30 }]);
      assert.equal(Object.values((await queryRow(db, "SELECT COUNT(*) AS n FROM admin_ui_state")) ?? {})[0], 1);
    } finally {
      db.close();
    }
  } finally {
    removeDir(dataDir);
  }
});