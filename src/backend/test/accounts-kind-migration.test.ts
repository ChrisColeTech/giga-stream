// Migration 031 (docs/62 decision D1 and section 3.1): existing accounts are admins by default, the CHECK
// holds, and the app's four tables appear with their cascades.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { Client } from "@libsql/client";

import { randomUUID } from "node:crypto";
import { createStore } from "../src/store/store.js";
import { removeDir, openTestDatabase, queryRow, queryRows, runSql } from "./db-kit.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

/** A database as it was before 031: migrations 001 to 030 and one account, with a session to be kept. */
async function oldDatabase(dataDir: string): Promise<string> {
  const file = path.join(dataDir, "admin.db");
  const db = await openTestDatabase(file);
  await runSql(db, "PRAGMA foreign_keys = ON");
  for (const name of readdirSync(MIGRATIONS).sort()) {
    const version = Number(name.slice(0, 3));
    if (version > 30) continue;
    await runSql(db, readFileSync(path.join(MIGRATIONS, name), "utf-8"));
    await runSql(db, `PRAGMA user_version = ${version}`);
  }
  await runSql(db, `INSERT INTO admin_accounts (id, username, username_key, password_hash, disabled,
      session_version, created_at, updated_at) VALUES
    ('acct_a', 'Boss', 'boss', 'scrypt$hash-a', 0, 2, 10, 11)`);
  await runSql(db, `INSERT INTO refresh_tokens (id, account_id, token_hash, created_at, expires_at)
    VALUES ('rt_1', 'acct_a', 'hash-1', 1, 100)`);
  db.close();
  return file;
}

const columnsOf = async (db: Client, table: string): Promise<string[]> =>
  (await queryRows(db, `PRAGMA table_info(${table})`)).map((row) => String(row.name));

test("031 defaults every existing account to admin, keeps its rows, and ends at version 31", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-kind-"));
  try {
    const store = await createStore(await oldDatabase(dataDir));
    const account = await store.accounts.find("acct_a");
    assert.equal(account?.account.kind, "admin", "existing rows are admins by default");
    assert.equal((await store.accounts.list()).length, 1);
    assert.ok(await store.refreshTokens.findByHash("hash-1"), "the session survives");
    store.close();
    const db = await openTestDatabase(path.join(dataDir, "admin.db"));
    try {
      assert.deepEqual(await queryRows(db, "PRAGMA user_version"), [{ user_version: 31 }]);
      const kind = (await columnsOf(db, "admin_accounts")).find((name) => name === "kind");
      assert.equal(kind, "kind");
    } finally {
      db.close();
    }
  } finally {
    removeDir(dataDir);
  }
});

test("the CHECK refuses a kind that is neither admin nor user", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-kind-check-"));
  try {
    (await createStore(await oldDatabase(dataDir))).close();
    const db = await openTestDatabase(path.join(dataDir, "admin.db"));
    try {
      await assert.rejects(() =>
        runSql(db, `INSERT INTO admin_accounts (id, username, username_key, kind, password_hash,
            disabled, session_version, created_at, updated_at)
          VALUES ('acct_x', 'X', 'x', 'robot', 'hash', 0, 1, 1, 1)`),
      );
    } finally {
      db.close();
    }
  } finally {
    removeDir(dataDir);
  }
});

test("the four user tables exist, and deleting the account takes its rows with it", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-kind-cascade-"));
  try {
    const store = await createStore(await oldDatabase(dataDir));
    const id = `acct_${randomUUID()}`;
    await store.accounts.insert(
      { id, username: "App User", kind: "user", passwordHash: "scrypt$hash-b", disabled: false },
      20,
    );
    await store.userSettings.upsert(id, '{"theme":"light"}', 21);
    await store.userFavorites.add(id, "title", "movie-603", 22);
    const collectionId = `col_${randomUUID()}`;
    await store.userCollections.insert({
      id: collectionId, accountId: id, name: "Weekend", type: "movie", createdAt: 23, updatedAt: 23,
    });
    await store.userCollections.addItem(collectionId, "title", "movie-429", 24);
    assert.equal(await store.userCollections.itemCount(collectionId), 1);

    await store.accounts.remove(id);
    assert.equal(await store.userSettings.find(id), undefined, "settings cascade");
    assert.deepEqual(await store.userFavorites.list(id), [], "favorites cascade");
    assert.equal(await store.userCollections.find(id, collectionId), undefined, "collections cascade");
    assert.equal(await store.userCollections.itemCount(collectionId), 0, "items cascade");
    store.close();

    const db = await openTestDatabase(path.join(dataDir, "admin.db"));
    try {
      for (const table of ["user_settings", "user_favorites", "user_collections", "user_collection_items"]) {
        assert.ok((await columnsOf(db, table)).length > 0, `${table} exists`);
      }
      assert.deepEqual(await queryRows(db, "SELECT COUNT(*) AS n FROM user_collection_items"), [{ n: 0 }]);
    } finally {
      db.close();
    }
  } finally {
    removeDir(dataDir);
  }
});

test("deleting a collection takes its items, and only its items", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-kind-items-"));
  try {
    const store = await createStore(await oldDatabase(dataDir));
    const id = `acct_${randomUUID()}`;
    await store.accounts.insert(
      { id, username: "Keeper", kind: "user", passwordHash: "scrypt$hash-c", disabled: false },
      20,
    );
    const gone = `col_${randomUUID()}`;
    const kept = `col_${randomUUID()}`;
    for (const [collection, ref] of [[gone, "movie-1"], [kept, "movie-2"]] as const) {
      await store.userCollections.insert({
        id: collection, accountId: id, name: collection, type: "movie", createdAt: 21, updatedAt: 21,
      });
      await store.userCollections.addItem(collection, "title", ref, 22);
    }
    await store.userCollections.remove(id, gone);
    assert.equal(await store.userCollections.itemCount(gone), 0, "the dropped collection's items go");
    assert.equal(await store.userCollections.itemCount(kept), 1, "the kept collection's items stay");
    assert.deepEqual(await store.userCollections.itemCollections(id, "title", "movie-2"), [kept]);
    store.close();
  } finally {
    removeDir(dataDir);
  }
});
