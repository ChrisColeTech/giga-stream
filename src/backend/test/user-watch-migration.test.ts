// Migration 032 (docs/63 section 3.2): the account's user_watch table appears with its per-account episode
// identity (the COALESCE unique index), its CHECKs on kind and state, and the account's delete cascading
// to its rows.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { createStore } from "../src/store/store.js";
import { isUniqueViolation } from "../src/store/database.js";
import { openTestDatabase, queryRows, removeDir, runSql } from "./db-kit.js";

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "store", "migrations");

/** A database as it was before 032: migrations 001 to 031 and two accounts. */
async function oldDatabase(dataDir: string): Promise<string> {
  const file = path.join(dataDir, "admin.db");
  const db = await openTestDatabase(file);
  await runSql(db, "PRAGMA foreign_keys = ON");
  for (const name of readdirSync(MIGRATIONS).sort()) {
    const version = Number(name.slice(0, 3));
    if (version > 31) continue;
    await runSql(db, readFileSync(path.join(MIGRATIONS, name), "utf-8"));
    await runSql(db, `PRAGMA user_version = ${version}`);
  }
  await runSql(db, `INSERT INTO admin_accounts (id, username, username_key, kind, password_hash, disabled,
      session_version, created_at, updated_at) VALUES
    ('acct_a', 'A', 'a', 'user', 'scrypt$hash-a', 0, 1, 10, 11),
    ('acct_b', 'B', 'b', 'user', 'scrypt$hash-b', 0, 1, 10, 11)`);
  db.close();
  return file;
}

type WatchStore = Awaited<ReturnType<typeof createStore>>;
const CountRow = z.object({ n: z.coerce.number() });

/** One raw statement through the store's own connection, for the rows the repositories have no verb for. */
async function exec(store: WatchStore, sql: string): Promise<void> {
  await store.transaction(async (txn) => {
    await txn.execute(sql);
  });
}

async function countOf(store: WatchStore, account: string): Promise<number> {
  return store.transaction(async (txn) => {
    const rows = await txn.execute({
      sql: "SELECT COUNT(*) AS n FROM user_watch WHERE account_id = ?",
      args: [account],
    });
    return CountRow.parse(rows.rows[0]).n;
  });
}

/** One watch row into one account, naming the identity parts the index keys on. */
const insertWatch = (store: WatchStore, account: string, id: string, season: number | null, episode: number | null,
  state = "watching", kind = "title"): Promise<void> =>
  exec(store, `INSERT INTO user_watch (id, account_id, item_kind, item_id, season, episode, position_ms,
      duration_ms, state, updated_at, playback_id, seq) VALUES
    ('${id}', '${account}', '${kind}', 'movie-603', ${season}, ${episode}, 1, 2, '${state}', 20, 'pb-${id}', 1)`);

test("032 creates the account's watch table with its two indexes, and ends at version 32", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-watch-migrate-"));
  try {
    (await createStore(await oldDatabase(dataDir))).close();
    const db = await openTestDatabase(path.join(dataDir, "admin.db"));
    try {
      assert.deepEqual(await queryRows(db, "PRAGMA user_version"), [{ user_version: 32 }]);
      const columns = await queryRows(db, "PRAGMA table_info(user_watch)");
      assert.deepEqual(columns.map((column) => column.name), [
        "id", "account_id", "item_kind", "item_id", "season", "episode", "position_ms", "duration_ms",
        "state", "updated_at", "playback_id", "seq",
      ]);
      const indexes = await queryRows(db, "PRAGMA index_list(user_watch)");
      const byName = new Map(indexes.map((index) => [index.name, index]));
      assert.equal(byName.get("idx_user_watch_identity")?.unique, 1, "the identity index is unique");
      assert.ok(byName.get("idx_user_watch_updated"), "the updated_at index exists");
    } finally {
      db.close();
    }
  } finally {
    removeDir(dataDir);
  }
});

test("the identity is the item with its exact episode, per account: one row per episode, never a merge", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-watch-identity-"));
  try {
    const store = await createStore(await oldDatabase(dataDir));
    // The movie entry (no episode) and each episode entry are different identities; the same identity
    // twice into one account loses to the unique index.
    await insertWatch(store, "acct_a", "w_movie", null, null);
    await insertWatch(store, "acct_a", "w_s1e1", 1, 1);
    await insertWatch(store, "acct_a", "w_s1e2", 1, 2);
    await insertWatch(store, "acct_b", "w_b_s1e1", 1, 1);
    await assert.rejects(() => insertWatch(store, "acct_a", "w_again", 1, 1), isUniqueViolation);
    assert.equal(await countOf(store, "acct_a"), 3);
    assert.equal(await countOf(store, "acct_b"), 1, "another account's same identity is its own row");
    store.close();
  } finally {
    removeDir(dataDir);
  }
});

test("the CHECKs refuse a kind or state that is not one of the watch's own", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-watch-check-"));
  try {
    const store = await createStore(await oldDatabase(dataDir));
    await assert.rejects(() => insertWatch(store, "acct_a", "w_x", null, null, "watching", "channel"));
    await assert.rejects(() => insertWatch(store, "acct_a", "w_x", null, null, "paused"));
    assert.equal(await countOf(store, "acct_a"), 0, "neither refusal landed a row");
    store.close();
  } finally {
    removeDir(dataDir);
  }
});

test("deleting the account takes its watch rows with it and leaves the other account's alone", async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "giga-backend-watch-cascade-"));
  try {
    const store = await createStore(await oldDatabase(dataDir));
    await insertWatch(store, "acct_a", `w_${randomUUID()}`, null, null);
    await insertWatch(store, "acct_b", `w_${randomUUID()}`, null, null);
    await store.accounts.remove("acct_a");
    assert.equal(await countOf(store, "acct_a"), 0, "the account's rows cascade");
    assert.equal(await countOf(store, "acct_b"), 1, "the other account's rows stay");
    store.close();
  } finally {
    removeDir(dataDir);
  }
});
