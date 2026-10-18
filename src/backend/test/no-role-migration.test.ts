// Migrations 015 and 016 (docs/26 decisions D22 and D24): a database in the old shape, with an owner, an editor,
// their sessions and providers carrying API keys, loses `role` and `api_key` and keeps every row and id.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/store/store.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

/** A database as it was before migration 015: migrations 001 to 014, accounts with roles, providers with keys. */
function oldDatabase(dataDir: string): string {
  const file = path.join(dataDir, "admin.db");
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");
  for (const name of readdirSync(MIGRATIONS).sort()) {
    const version = Number(name.slice(0, 3));
    if (version > 14) continue;
    db.exec(readFileSync(path.join(MIGRATIONS, name), "utf-8"));
    db.exec(`PRAGMA user_version = ${version}`);
  }
  db.exec(`INSERT INTO admin_accounts (id, email, email_key, name, role, password_hash, disabled, session_version,
      failed_sign_ins, locked_until, created_at, updated_at, last_sign_in_at) VALUES
    ('acct_a', 'Boss@Example.test', 'boss@example.test', 'Boss', 'owner', 'scrypt$hash-a', 0, 4, 2, NULL, 10, 11, 12),
    ('acct_b', 'ed@example.test', 'ed@example.test', 'Ed', 'editor', 'scrypt$hash-b', 1, 1, 0, 99, 20, 21, NULL)`);
  db.exec(`INSERT INTO refresh_tokens (id, account_id, token_hash, created_at, expires_at, used_at, revoked_at)
    VALUES ('rt_1', 'acct_a', 'hash-1', 1, 100, NULL, NULL)`);
  db.exec(`INSERT INTO providers (id, name, source, api_key, is_active, created_at, "order", family, movie_template,
      episode_template, start_param, subtitles_param, origin, frame_origins, message_shape) VALUES
    (3, 'Cinezo', 'cinezo', 'secret-key', 1, '2026-10-01T00:00:00.000Z', 0, 'embed', 'https://c.example/{tmdbId}', NULL,
      'start', NULL, 'https://c.example', '["https://c.example"]', 'player-event'),
    (9, 'Other', 'other', '', 0, '2026-10-02T00:00:00.000Z', 5, 'stream', NULL, NULL, NULL, NULL, NULL, NULL, NULL)`);
  db.close();
  return file;
}

const columnsOf = (db: DatabaseSync, table: string): string[] =>
  db.prepare(`PRAGMA table_info(${table})`).all().map((row) => String(row.name));

test("migrations 015 and 016 drop role and api_key and keep every row, id and the sessions", () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-migrate-"));
  try {
    createStore(oldDatabase(dataDir)).close();
    const db = new DatabaseSync(path.join(dataDir, "admin.db"), { readOnly: true });
    try {
      // Migrations 017 (account UI state), 018 (security questions), 019 (username), 020 (deleted titles), 021, 022
      // (the playlist model) and 023 (no lockout) run after 015 and 016.
      assert.deepEqual({ ...db.prepare("PRAGMA user_version").get() }, { user_version: 26 });
      verifyRows(db);
    } finally {
      db.close();
    }
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

function verifyRows(db: DatabaseSync): void {

    assert.equal(columnsOf(db, "admin_accounts").includes("role"), false);
    assert.equal(columnsOf(db, "providers").includes("api_key"), false);

    const accounts = db.prepare(`SELECT id, username, username_key, password_hash, disabled, session_version,
      created_at, updated_at, last_sign_in_at FROM admin_accounts ORDER BY id`).all().map((row) => ({ ...row }));
    // Migration 018 gives every existing account no security question.
    const questions = db.prepare("SELECT security_question, security_answer_hash FROM admin_accounts").all();
    const none = { security_question: null, security_answer_hash: null };
    assert.deepEqual(questions.map((row) => ({ ...row })), [none, none]);
    assert.deepEqual(accounts, [
      { id: "acct_a", username: "Boss@Example.test", username_key: "boss@example.test", password_hash: "scrypt$hash-a",
        disabled: 0, session_version: 4, created_at: 10, updated_at: 11, last_sign_in_at: 12 },
      { id: "acct_b", username: "ed@example.test", username_key: "ed@example.test", password_hash: "scrypt$hash-b",
        disabled: 1, session_version: 1, created_at: 20, updated_at: 21, last_sign_in_at: null },
    ]);
    const tokens = db.prepare("SELECT id, account_id, token_hash FROM refresh_tokens").all().map((row) => ({ ...row }));
    assert.deepEqual(tokens, [{ id: "rt_1", account_id: "acct_a", token_hash: "hash-1" }]);

    const providers = db.prepare("SELECT id, name, source, is_active, \"order\", family, movie_template, origin, message_shape FROM providers ORDER BY id").all();
    assert.deepEqual(providers.map((row) => ({ ...row })), [
      { id: 3, name: "Cinezo", source: "cinezo", is_active: 1, order: 0, family: "embed", movie_template: "https://c.example/{tmdbId}",
        origin: "https://c.example", message_shape: "player-event" },
      { id: 9, name: "Other", source: "other", is_active: 0, order: 5, family: "stream", movie_template: null, origin: null, message_shape: null },
    ]);
}

test("after the migrations the store reads the old accounts and providers, and a new provider takes the next id", () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-migrate-"));
  try {
    const store = createStore(oldDatabase(dataDir));
    assert.deepEqual(store.accounts.list().map((a) => [a.account.id, a.account.username, a.account.disabled]), [
      ["acct_a", "Boss@Example.test", false],
      ["acct_b", "ed@example.test", true],
    ]);
    assert.equal(store.accounts.enabledCount(), 1);
    assert.deepEqual(store.providers.list().map((p) => [p.id, p.name]), [[3, "Cinezo"], [9, "Other"]]);
    const next = store.providers.insert({
      name: "New", source: "new", is_active: 1, created_at: "2026-10-17T00:00:00.000Z", order: 1, family: "embed",
      movie_template: null, episode_template: null, start_param: null, subtitles_param: null, origin: null,
      frame_origins: null, message_shape: null,
    });
    assert.equal(next, 10);
    store.close();
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
