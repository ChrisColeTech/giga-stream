import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

import { AppError } from "../lib/app-error.js";
import { migrate } from "./migrate.js";

export type Database = DatabaseSync;

const BUSY_TIMEOUT_MS = 5000;

/**
 * The one `DatabaseSync` owner (`01` §4.1): opens the file, sets the connection pragmas and runs
 * the migrations. Everything else receives this handle; nothing else opens a database.
 * `:memory:` is allowed for tests that need no file.
 */
export function openDatabase(file: string): Database {
  let db: Database | undefined;
  try {
    if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
    db = new DatabaseSync(file);
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
    // WAL needs a real file; an in-memory database simply keeps its own journal mode.
    if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  } catch (error) {
    db?.close();
    throw new AppError("store.open", 500, "The local database could not be opened.", undefined, error);
  }
  try {
    migrate(db);
  } catch (error) {
    db.close();
    throw error;
  }
  return db;
}

/** `GET /healthz` uses this: a trivial read proves the handle is usable. */
export function pingDatabase(db: Database): void {
  try {
    db.prepare("SELECT 1").get();
  } catch (error) {
    throw new AppError("store.failed", 503, "The local database is not available.", undefined, error);
  }
}
