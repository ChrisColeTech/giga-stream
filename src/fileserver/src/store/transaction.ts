import type { DatabaseSync } from "node:sqlite";

/**
 * Run `work` inside one transaction: commit when it returns, roll back and rethrow when it
 * throws. Not reentrant: SQLite has no nested BEGIN, so a repository method that opens one must
 * not be called from inside another.
 */
export function inTransaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // SQLite already rolled the transaction back (for example after SQLITE_FULL); keep the original error.
    }
    throw error;
  }
}
