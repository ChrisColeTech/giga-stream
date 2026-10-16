import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { AppError, ERRORS } from "../constants/errors.js";
import { runInTransaction } from "./database.js";

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
const MIGRATION_FILE = /^(\d{3})-[a-z0-9-]+\.sql$/;
const VersionRow = z.object({ user_version: z.number().int() });

interface Migration {
  version: number;
  sql: string;
}

function loadMigrations(): Migration[] {
  const found: Migration[] = [];
  for (const name of readdirSync(MIGRATIONS_DIR)) {
    const match = MIGRATION_FILE.exec(name);
    if (match?.[1]) found.push({ version: Number(match[1]), sql: readFileSync(path.join(MIGRATIONS_DIR, name), "utf-8") });
  }
  return found.sort((a, b) => a.version - b.version);
}

function currentVersion(db: DatabaseSync): number {
  return VersionRow.parse(db.prepare("PRAGMA user_version").get()).user_version;
}

/**
 * Forward-only, numbered, each in its own transaction. A database written by newer code is refused
 * outright: running old code against a newer schema would corrupt it.
 */
export function migrate(db: DatabaseSync): void {
  const migrations = loadMigrations();
  const latest = migrations.at(-1)?.version ?? 0;
  const version = currentVersion(db);
  if (version > latest) {
    throw new AppError(ERRORS.storeNewerSchema, { databaseVersion: version, supportedVersion: latest });
  }
  for (const migration of migrations.filter((m) => m.version > version)) {
    try {
      runInTransaction(db, () => {
        db.exec(migration.sql);
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
