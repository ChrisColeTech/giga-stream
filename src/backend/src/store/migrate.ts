import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { AppError, ERRORS } from "../constants/errors.js";
import { runInTransaction, type Database, type Executor } from "./database.js";

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
const MIGRATION_FILE = /^(\d{3})-[a-z0-9-]+\.sql$/;
/** A migration whose first line is this is preceded by a `VACUUM INTO` backup of an existing database. */
const BACKUP_DIRECTIVE = /^-- migrate: backup\s*$/;
const VersionRow = z.object({ user_version: z.number().int() });
const DatabaseRow = z.object({ name: z.string(), file: z.string() });
/**
 * Where the schema version lives on a remote database (Turso): the server refuses `PRAGMA user_version`
 * writes over the network protocol, so the same one-row table stands in for it there. A local file keeps
 * the pragma, whose write is atomic with the migration's transaction.
 */
const VERSION_TABLE = "giga_stream_schema_version";
const VersionTableRow = z.object({ version: z.coerce.number().int() });

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

/** A remote database (Turso) keeps its version in `VERSION_TABLE`: it cannot write the pragma at all. */
async function currentVersion(db: Executor, remote: boolean): Promise<number> {
  if (remote) {
    const rows = (await db.execute(`SELECT version FROM ${VERSION_TABLE} WHERE id = 1`)).rows;
    return rows.length === 0 ? 0 : VersionTableRow.parse(rows[0]).version;
  }
  const rows = (await db.execute("PRAGMA user_version")).rows;
  return VersionRow.parse(rows[0]).user_version;
}

/** The remote stand-in for the pragma write, after a migration's transaction has committed. */
async function writeRemoteVersion(db: Database, version: number): Promise<void> {
  await db.execute(
    `INSERT INTO ${VERSION_TABLE} (id, version) VALUES (1, ${version}) ` +
      "ON CONFLICT(id) DO UPDATE SET version = excluded.version",
  );
}

/** The main database's file, or "" for an in-memory or remote one (a remote engine keeps no file to back up). */
async function databaseFile(db: Database): Promise<string> {
  if (db.protocol !== "file") return "";
  const rows = (await db.execute("PRAGMA database_list")).rows.map((row) => DatabaseRow.parse(row));
  return rows.find((row) => row.name === "main")?.file ?? "";
}

/**
 * A copy of the database before a migration that rebuilds tables, written as `<db>.pre-<version>`. It runs outside any
 * transaction (`VACUUM INTO` cannot run in one) and is skipped when that file already exists (`VACUUM INTO` fails on one).
 */
async function backUp(db: Database, version: number): Promise<void> {
  const file = await databaseFile(db);
  if (file === "") return;
  const target = `${file}.pre-${String(version).padStart(3, "0")}`;
  if (existsSync(target)) return;
  await db.execute(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
}

/** A rebuilt table must leave every reference intact: any row `foreign_key_check` reports aborts the migration. */
async function checkReferences(handle: Executor): Promise<void> {
  const broken = (await handle.execute("PRAGMA foreign_key_check")).rows;
  if (broken.length > 0) throw new Error(`foreign_key_check reported ${broken.length} broken reference(s)`);
}

/**
 * Forward-only, numbered, each in its own transaction. A database written by newer code is refused
 * outright: running old code against a newer schema would corrupt it. A migration marked
 * `-- migrate: backup` is preceded by a backup when the database already holds data (`user_version` above 0), and
 * every migration ends with a foreign-key check inside its transaction. The schema version is the
 * `user_version` pragma on a local file (written inside the same transaction); a remote database
 * (Turso refuses pragma writes over the network) keeps it in `VERSION_TABLE`, written after each commit.
 */
export async function migrate(db: Database): Promise<void> {
  const migrations = loadMigrations();
  const latest = migrations.at(-1)?.version ?? 0;
  const remote = db.protocol !== "file";
  if (remote) {
    // The version table is infrastructure, not a migration: it exists before any of them runs, and no
    // migration is ever named like it.
    await db.execute(
      `CREATE TABLE IF NOT EXISTS ${VERSION_TABLE} (id integer primary key check (id = 1), version integer not null)`,
    );
  }
  const version = await currentVersion(db, remote);
  if (version > latest) {
    throw new AppError(ERRORS.storeNewerSchema, { databaseVersion: version, supportedVersion: latest });
  }
  const pending = migrations.filter((m) => m.version > version);
  const marked = pending.find((m) => m.backup);
  try {
    if (marked && version > 0) await backUp(db, marked.version);
  } catch (cause) {
    throw new AppError(ERRORS.storeMigrate, {
      version: marked?.version,
      reason: cause instanceof Error ? cause.message : "backup failed",
    });
  }
  for (const migration of pending) {
    try {
      await runInTransaction(db, async (txn) => {
        await txn.executeMultiple(migration.sql);
        await checkReferences(txn);
        // The pragma write joins the transaction locally. Remote, the server refuses every pragma
        // write, so the version row is written right after the commit instead.
        if (!remote) await txn.executeMultiple(`PRAGMA user_version = ${migration.version}`);
      });
      if (remote) await writeRemoteVersion(db, migration.version);
    } catch (cause) {
      throw new AppError(ERRORS.storeMigrate, {
        version: migration.version,
        reason: cause instanceof Error ? cause.message : "migration failed",
      });
    }
  }
}
