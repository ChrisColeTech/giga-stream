// Migration 019 (username): a copy of an 018 database migrates with every account kept, its values untouched, the
// audit and reset-attempt columns renamed with them, and old audit details naming `username` instead of `email`.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { DATABASE_FILE_NAME } from "../src/constants/deployment.js";
import { createStore } from "../src/store/store.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

/** A database as migrations 001 to 018 left it, with two accounts, two audit rows and one reset attempt. */
function database018(dataDir: string): string {
  const file = path.join(dataDir, DATABASE_FILE_NAME);
  const db = new DatabaseSync(file);
  try {
    for (const name of readdirSync(MIGRATIONS).sort()) {
      const version = Number(name.slice(0, 3));
      if (version > 18) continue;
      db.exec(readFileSync(path.join(MIGRATIONS, name), "utf-8"));
      db.exec(`PRAGMA user_version = ${version}`);
    }
    db.exec(`INSERT INTO admin_accounts (id, email, email_key, name, password_hash, disabled, session_version,
        failed_sign_ins, locked_until, created_at, updated_at, last_sign_in_at, security_question, security_answer_hash)
      VALUES
        ('acct_a', 'Owner@Example.test', 'owner@example.test', 'Owner', 'scrypt$hash-a', 0, 2, 1, NULL, 10, 11, 12, 3, 'scrypt$ans'),
        ('acct_b', 'dev@example.test', 'dev@example.test', 'Dev', 'scrypt$hash-b', 1, 1, 0, 99, 20, 21, NULL, NULL, NULL)`);
    db.exec(`INSERT INTO audit_log (at, actor_id, actor_email, action, subject, detail, address) VALUES
      (1, 'acct_a', 'Owner@Example.test', 'account.created', 'acct_b', '{"email":"dev@example.test"}', '127.0.0.1'),
      (2, NULL, NULL, 'channel.created', NULL, '{"kind":"live"}', NULL)`);
    db.exec("INSERT INTO reset_attempts (email_key, failed, locked_until) VALUES ('dev@example.test', 2, NULL)");
  } finally {
    db.close();
  }
  return file;
}

function inFolder(work: (dataDir: string) => void): void {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-username-migration-"));
  try {
    work(dataDir);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
}

test("019 on an 018 database: version 19, every account kept as it was, now under username", () => {
  inFolder((dataDir) => {
    const file = database018(dataDir);
    const store = createStore(file);
    try {
      const rows = store.accounts.list();
      const accounts = rows.map((a) => [a.account.id, a.account.username, a.account.disabled]);
      assert.deepEqual(accounts, [
        ["acct_b", "dev@example.test", true],
        ["acct_a", "Owner@Example.test", false],
      ]);
      assert.equal(store.accounts.findByUsername("OWNER@example.test")?.account.id, "acct_a", "found without case");
      assert.equal(store.accounts.find("acct_a")?.passwordHash, "scrypt$hash-a");
      assert.equal(store.accounts.find("acct_a")?.account.securityQuestionSet, true);
      assert.deepEqual(store.resetAttempts.find("dev@example.test"), { failed: 2, lockedUntil: null });
    } finally {
      store.close();
    }

    const db = new DatabaseSync(file, { readOnly: true });
    try {
      // 019 is followed by 020 (deleted titles), 021 and 022 (the playlist model), so the schema ends at 22.
      assert.deepEqual({ ...db.prepare("PRAGMA user_version").get() }, { user_version: 22 });
      const columns = (table: string): string[] => db.prepare(`PRAGMA table_info(${table})`).all().map((r) => String(r.name));
      assert.equal(columns("admin_accounts").some((c) => c.startsWith("email")), false);
      assert.equal(columns("audit_log").includes("actor_email"), false);
      assert.deepEqual(columns("reset_attempts"), ["username_key", "failed", "locked_until"]);
      const audit = db.prepare("SELECT actor_username, detail FROM audit_log ORDER BY id").all().map((r) => ({ ...r }));
      assert.deepEqual(audit, [
        { actor_username: "Owner@Example.test", detail: '{"username":"dev@example.test"}' },
        { actor_username: null, detail: '{"kind":"live"}' },
      ]);
    } finally {
      db.close();
    }
  });
});

test("after 019 the username key stays unique without case", () => {
  inFolder((dataDir) => {
    const store = createStore(database018(dataDir));
    const write = { id: "acct_c", username: "DEV@example.test", passwordHash: "scrypt$c", disabled: false };
    assert.throws(() => store.accounts.insert(write, 30));
    store.accounts.insert({ ...write, username: "a plain name" }, 30);
    assert.equal(store.accounts.findByUsername("A Plain Name")?.account.id, "acct_c");
    store.close();
  });
});
