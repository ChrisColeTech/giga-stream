import { AsyncLocalStorage } from "node:async_hooks";

import {
  createClient, type Client, type InArgs, type InStatement, type ResultSet,
  type Transaction, type TransactionMode,
} from "@libsql/client";
import { z } from "zod";

import { AppError } from "../lib/app-error.js";

export type AdminDatabase = Client;

class ScopedAdminDatabase implements Client {
  private readonly transactionScope = new AsyncLocalStorage<Transaction>();
  constructor(private readonly inner: Client) {}
  execute(stmt: InStatement): Promise<ResultSet>;
  execute(sql: string, args?: InArgs): Promise<ResultSet>;
  execute(stmtOrSql: InStatement | string, args?: InArgs): Promise<ResultSet> {
    const statement: InStatement = typeof stmtOrSql === "string" ? { sql: stmtOrSql, args } : stmtOrSql;
    return (this.transactionScope.getStore() ?? this.inner).execute(statement);
  }
  executeMultiple(sql: string): Promise<void> {
    return (this.transactionScope.getStore() ?? this.inner).executeMultiple(sql);
  }
  batch(statements: InStatement[]): Promise<ResultSet[]> {
    return (this.transactionScope.getStore() ?? this.inner).batch(statements);
  }
  transaction(mode?: TransactionMode): Promise<Transaction> { return this.inner.transaction(mode); }
  migrate(statements: InStatement[]): Promise<ResultSet[]> { return this.inner.migrate(statements); }
  sync() { return this.inner.sync(); }
  reconnect(): void { void this.inner.reconnect(); }
  close(): void { this.inner.close(); }
  get closed(): boolean { return this.inner.closed; }
  get protocol(): string { return this.inner.protocol; }
  run<T>(transaction: Transaction, work: () => Promise<T>): Promise<T> {
    return this.transactionScope.run(transaction, work);
  }
}

export function scopeAdminDatabase(database: Client): AdminDatabase {
  return database instanceof ScopedAdminDatabase ? database : new ScopedAdminDatabase(database);
}

export async function runAdminTransaction<T>(
  database: AdminDatabase,
  work: () => Promise<T>,
): Promise<T> {
  if (!(database instanceof ScopedAdminDatabase)) {
    throw new Error("the admin database transaction scope is not installed");
  }
  const transaction = await database.transaction("write");
  try {
    const result = await database.run(transaction, work);
    await transaction.commit();
    return result;
  } catch (error) {
    if (!transaction.closed) await transaction.rollback();
    throw error;
  }
}

const REQUIRED_SCHEMA_VERSION = 32;
const VersionRow = z.object({ version: z.coerce.number().int() });
const PragmaRow = z.object({ user_version: z.coerce.number().int() });

/** Opens the fileserver's one authoritative admin-database client. Tests inject this seam. */
export function openAdminDatabase(url: string, authToken: string): AdminDatabase {
  if (url === "") {
    throw new AppError("store.failed", 500, "The admin database is not configured.");
  }
  return scopeAdminDatabase(createClient({ url, authToken: authToken === "" ? undefined : authToken }));
}

/** Refuses any schema other than the backend contract this fileserver was compiled against. */
export async function validateAdminSchema(database: AdminDatabase): Promise<void> {
  let value: number | undefined;
  try {
    const result = await database.execute(
      "SELECT version FROM giga_stream_schema_version WHERE id = 1",
    );
    const row = result.rows[0];
    const version = row === undefined ? undefined : VersionRow.safeParse(row);
    value = version?.success ? version.data.version : undefined;
  } catch (cause) {
    if (database.protocol !== "file") {
      throw new AppError("store.failed", 500, "The admin database schema could not be read.", undefined, cause);
    }
    try {
      value = PragmaRow.parse((await database.execute("PRAGMA user_version")).rows[0]).user_version;
    } catch (fallbackCause) {
      throw new AppError(
        "store.failed", 500, "The admin database schema could not be read.", undefined, fallbackCause,
      );
    }
  }
  if (value !== REQUIRED_SCHEMA_VERSION) {
    throw new AppError(
      "store.failed", 500, `The admin database schema must be version ${REQUIRED_SCHEMA_VERSION}.`,
    );
  }
}
