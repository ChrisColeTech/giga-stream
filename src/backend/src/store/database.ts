import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { AppError, ERRORS } from "../constants/errors.js";
import { DATABASE_BUSY_TIMEOUT_MS } from "../constants/limits.js";

/**
 * The one `DatabaseSync` owner of the admin backend (`01` section 4.1). Everything else receives this
 * handle from the store composition root; nothing else opens a database.
 */
export function openDatabase(file: string): DatabaseSync {
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    const db = new DatabaseSync(file);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(`PRAGMA busy_timeout = ${DATABASE_BUSY_TIMEOUT_MS}`);
    return db;
  } catch (cause) {
    throw new AppError(ERRORS.storeFailed, { reason: cause instanceof Error ? cause.message : "open failed" });
  }
}

/** Runs `work` in one write transaction; any throw rolls everything back. */
export function runInTransaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
