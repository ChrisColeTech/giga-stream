// The tests' one database opener: the same local url handling as the store's `openDatabase`, without the
// production branch or the pragmas (a fixture builds the schema it needs itself).
import { rmSync } from "node:fs";

import { createClient, type Client, type InValue } from "@libsql/client";

import { fileUrl } from "../src/store/database.js";

/** A client on a local database file (or `:memory:`), as every fixture and read-only peek opens one. */
export function openTestDatabase(file: string): Promise<Client> {
  return Promise.resolve(createClient({ url: fileUrl(file), authToken: undefined }));
}

/**
 * Best effort: the driver frees a database file's handle only when its prepared statements are collected, so a
 * temporary folder may survive on Windows until the process ends. The OS temporary folder outlives it either way.
 */
export function removeDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    // not everything was collected yet; nothing the test asserts depends on the deletion
  }
}

/** Runs one or more statements (`;`-separated scripts included) and answers nothing. */
export const runSql = (db: Client, sql: string): Promise<void> => db.executeMultiple(sql);

/** Runs one parameterized statement and answers the whole row set as plain objects. */
export const queryRows = async (
  db: Client,
  sql: string,
  args: InValue[] = [],
): Promise<Array<Record<string, unknown>>> =>
  (await db.execute({ sql, args })).rows.map((row) => ({ ...row }));

/** Runs one parameterized statement and answers its first row, or undefined. */
export const queryRow = async (
  db: Client,
  sql: string,
  args: InValue[] = [],
): Promise<Record<string, unknown> | undefined> => (await queryRows(db, sql, args))[0];
