import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AppError } from "../lib/app-error.js";
import { inTransaction } from "./transaction.js";

interface Migration {
  version: number;
  file: string;
}

const MIGRATION_FILE = /^(\d{3})-[a-z0-9-]+\.sql$/;
const IF_TABLE_EXISTS = /^-- migrate-if-table-exists: ([a-z][a-z0-9_]*)$/m;

/**
 * Where the numbered `.sql` files live. `tsc` does not copy them, so a compiled run (`dist/store`)
 * falls back to the sources beside it; tsx and the tests find them next to this file.
 */
const MIGRATION_DIRS = [
  fileURLToPath(new URL("./migrations/", import.meta.url)),
  fileURLToPath(new URL("../../src/store/migrations/", import.meta.url)),
];

function listMigrations(): Migration[] {
  const dir = MIGRATION_DIRS.find((candidate) => existsSync(candidate));
  if (!dir) throw new AppError("store.migrate", 500, "The local database migrations are missing.");
  const found: Migration[] = [];
  for (const name of readdirSync(dir)) {
    const match = MIGRATION_FILE.exec(name);
    if (match?.[1]) found.push({ version: Number(match[1]), file: path.join(dir, name) });
  }
  return found.sort((a, b) => a.version - b.version);
}

export function readSchemaVersion(db: DatabaseSync): number {
  const row = db.prepare("PRAGMA user_version").get();
  return Number(row?.user_version ?? 0);
}

function canApply(db: DatabaseSync, sql: string): boolean {
  const table = IF_TABLE_EXISTS.exec(sql)?.[1];
  if (!table) return true;
  return db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) !== undefined;
}

/**
 * Forward-only, numbered, transactional (`02` §7.1). A database written by a newer build is
 * refused untouched (`store.newer_schema`); a failing migration rolls back whole (`store.migrate`).
 * Returns the schema version now in place.
 */
export function migrate(db: DatabaseSync): number {
  const migrations = listMigrations();
  const latest = migrations.at(-1)?.version ?? 0;
  const current = readSchemaVersion(db);
  if (current > latest) {
    throw new AppError(
      "store.newer_schema",
      500,
      "The local database was written by a newer version of Giga Stream. Update the app to open it.",
      { found: current, supported: latest },
    );
  }
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    try {
      const sql = readFileSync(migration.file, "utf-8");
      inTransaction(db, () => {
        if (canApply(db, sql)) db.exec(sql);
        // user_version takes no bound parameter; the value is an integer parsed from a file name.
        db.exec(`PRAGMA user_version = ${migration.version}`);
      });
    } catch (error) {
      throw new AppError(
        "store.migrate",
        500,
        "The local database could not be upgraded.",
        { version: migration.version },
        error,
      );
    }
  }
  return latest;
}
