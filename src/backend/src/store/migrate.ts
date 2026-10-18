import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { AppError, ERRORS } from "../constants/errors.js";
import { runInTransaction } from "./database.js";

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
const MIGRATION_FILE = /^(\d{3})-[a-z0-9-]+\.sql$/;
/** A migration whose first line is this is preceded by a `VACUUM INTO` backup of an existing database. */
const BACKUP_DIRECTIVE = /^-- migrate: backup\s*$/;
const VersionRow = z.object({ user_version: z.number().int() });
const DatabaseRow = z.object({ name: z.string(), file: z.string() });

interface Migration {
  version: number;
  sql: string;
  backup: boolean;
}

function loadMigrations(): Migration[] {
  const found: Migration[] = [];
  for (const name of readdirSync(MIGRATIONS_DIR)) {
    const match = MIGRATION_FILE.exec(name);
    if (!match?.[1]) continue;
    const sql = readFileSync(path.join(MIGRATIONS_DIR, name), "utf-8");
    found.push({ version: Number(match[1]), sql, backup: BACKUP_DIRECTIVE.test(sql.split(/\r?\n/, 1)[0] ?? "") });
  }
  return found.sort((a, b) => a.version - b.version);
}

function currentVersion(db: DatabaseSync): number {
  return VersionRow.parse(db.prepare("PRAGMA user_version").get()).user_version;
}

/** The main database's file, or "" for an in-memory one. */
function databaseFile(db: DatabaseSync): string {
  const rows = db.prepare("PRAGMA database_list").all().map((row) => DatabaseRow.parse(row));
  return rows.find((row) => row.name === "main")?.file ?? "";
}

/**
 * A copy of the database before a migration that rebuilds tables, written as `<db>.pre-<version>`. It runs outside any
 * transaction (`VACUUM INTO` cannot run in one) and is skipped when that file already exists (`VACUUM INTO` fails on one).
 */
function backUp(db: DatabaseSync, version: number): void {
  const file = databaseFile(db);
  if (file === "") return;
  const target = `${file}.pre-${String(version).padStart(3, "0")}`;
  if (existsSync(target)) return;
  db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
}

/** A rebuilt table must leave every reference intact: any row `foreign_key_check` reports aborts the migration. */
function checkReferences(db: DatabaseSync): void {
  const broken = db.prepare("PRAGMA foreign_key_check").all();
  if (broken.length > 0) throw new Error(`foreign_key_check reported ${broken.length} broken reference(s)`);
}

/**
 * Forward-only, numbered, each in its own transaction. A database written by newer code is refused
 * outright: running old code against a newer schema would corrupt it. A migration marked
 * `-- migrate: backup` is preceded by a backup when the database already holds data (`user_version` above 0), and
 * every migration ends with a foreign-key check inside its transaction.
 */
export function migrate(db: DatabaseSync): void {
  const migrations = loadMigrations();
  const latest = migrations.at(-1)?.version ?? 0;
  const version = currentVersion(db);
  if (version > latest) {
    throw new AppError(ERRORS.storeNewerSchema, { databaseVersion: version, supportedVersion: latest });
  }
  const pending = migrations.filter((m) => m.version > version);
  const marked = pending.find((m) => m.backup);
  try {
    if (marked && version > 0) backUp(db, marked.version);
  } catch (cause) {
    throw new AppError(ERRORS.storeMigrate, {
      version: marked?.version,
      reason: cause instanceof Error ? cause.message : "backup failed",
    });
  }
  for (const migration of pending) {
    try {
      runInTransaction(db, () => {
        db.exec(migration.sql);
        checkReferences(db);
        db.exec(`PRAGMA user_version = ${migration.version}`);
      });
    } catch (cause) {
      throw new AppError(ERRORS.storeMigrate, {
        version: migration.version,
        reason: cause instanceof Error ? cause.message : "migration failed",
      });
    }
  }
}
