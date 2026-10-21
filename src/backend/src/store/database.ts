import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { createClient, type Client, type InArgs, type InStatement, type InValue, type Transaction,
  type TransactionMode, type ResultSet } from "@libsql/client";

import { config, type Config } from "../config.js";
import { AppError, ERRORS } from "../constants/errors.js";
import { DATABASE_BUSY_TIMEOUT_MS } from "../constants/limits.js";

/** The one store handle the repositories accept (`01` section 4.1). */
export type Database = Client;

/** Anything that runs statements: the store's client, or one transaction of `runInTransaction`. */
export type Executor = Client | Transaction;

/** The arguments a statement binds: what libsql accepts, so repositories need no second name for it. */
export type SqlArgs = InValue[];

/**
 * Production keeps its store in the remote Turso database (`docs/13`): the Render disk is ephemeral, so a local
 * file would lose every admin account on each deploy. The store refuses to open without the address.
 */
async function openRemote(): Promise<Client> {
  if (config.TURSO_DATABASE_URL === "") {
    throw new AppError(ERRORS.storeFailed, {
      reason: "TURSO_DATABASE_URL is empty: production keeps its store in the remote Turso database",
    });
  }
  return createClient({ url: config.TURSO_DATABASE_URL, authToken: config.TURSO_AUTH_TOKEN || undefined });
}

/** An explicit Turso address wins in every runtime; production still refuses to fall back to a local file. */
export function databaseSelection(
  nodeEnv: Config["NODE_ENV"],
  databaseUrl: string,
): "local" | "remote" | "refuse" {
  if (databaseUrl !== "") return "remote";
  return nodeEnv === "production" ? "refuse" : "local";
}

/** `@libsql/client` wants a local file behind a `file:` url; `:memory:` (the tests' database) is a url of its own. */
export function fileUrl(file: string): string {
  if (file === ":memory:") return file;
  return "file:" + path.resolve(file);
}

/** The connection settings of a local file: WAL, foreign keys and the busy wait (`01` section 4.1). */
const LOCAL_PRAGMAS = [
  "PRAGMA journal_mode = WAL",
  "PRAGMA foreign_keys = ON",
  `PRAGMA busy_timeout = ${DATABASE_BUSY_TIMEOUT_MS}`,
];

/** Applies one pragma; a refusal must not kill the boot (a remote engine answers none of them). */
async function applyPragmas(client: Client): Promise<void> {
  for (const pragma of LOCAL_PRAGMAS) {
    try {
      await client.execute(pragma);
    } catch {
      // The pragma is an optimization or a default; the store works without it.
    }
  }
}

/**
 * Statements issued while a transaction of this client is open must run on that transaction, or they land on
 * another pooled connection and miss it. Repositories keep the client they were built with, so the client itself
 * dispatches: inside `runInTransaction`'s callback every `execute` of this process goes to the open transaction.
 */
const transactionScope = new AsyncLocalStorage<Transaction>();

/** The handle a statement goes to: the open transaction of this async context, else the client's pool. */
function executorOf(db: Client): Client | Transaction {
  return transactionScope.getStore() ?? db;
}

/** A `Client` whose statements join the transaction `runInTransaction` has open in the calling async context. */
class ScopedClient implements Client {
  constructor(private readonly inner: Client) {}

  execute(stmt: InStatement): Promise<ResultSet>;
  execute(sql: string, args?: InArgs): Promise<ResultSet>;
  execute(stmtOrSql: InStatement | string, args?: InArgs): Promise<ResultSet> {
    const stmt: InStatement = typeof stmtOrSql === "string" ? { sql: stmtOrSql, args } : stmtOrSql;
    return executorOf(this.inner).execute(stmt);
  }

  executeMultiple(sql: string): Promise<void> {
    return executorOf(this.inner).executeMultiple(sql);
  }

  batch(stmts: Array<InStatement>): Promise<Array<ResultSet>> {
    return executorOf(this.inner).batch(stmts);
  }

  transaction(mode?: TransactionMode): Promise<Transaction> {
    return this.inner.transaction(mode);
  }

  migrate(stmts: Array<InStatement>): Promise<Array<ResultSet>> {
    return this.inner.migrate(stmts);
  }

  sync() {
    return this.inner.sync();
  }

  reconnect(): void {
    void this.inner.reconnect();
  }

  close(): void {
    this.inner.close();
  }

  get closed(): boolean {
    return this.inner.closed;
  }

  get protocol(): string {
    return this.inner.protocol;
  }
}

/**
 * The one owner of the admin backend's database (`01` section 4.1). Everything else receives this handle from the
 * store composition root; nothing else opens a database. With a configured Turso address the handle is remote and
 * `file` is ignored; otherwise development and tests use the local file (or `:memory:`). Production never falls back.
 */
export async function openDatabase(file: string): Promise<Client> {
  try {
    const selection = databaseSelection(config.NODE_ENV, config.TURSO_DATABASE_URL);
    if (selection !== "local") return new ScopedClient(await openRemote());
    const url = fileUrl(file);
    if (url.startsWith("file:")) mkdirSync(path.dirname(file), { recursive: true });
    const client = createClient({
      url,
      authToken: undefined,
      // The busy wait is a setting of the local engine's connections; the pragma below repeats it for a driver
      // that answers pragmas but not this option.
      timeout: DATABASE_BUSY_TIMEOUT_MS,
    });
    if (url.startsWith("file:")) await applyPragmas(client);
    return new ScopedClient(client);
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw new AppError(ERRORS.storeFailed, { reason: cause instanceof Error ? cause.message : "open failed" });
  }
}

/** Whether SQLite refused a write for a UNIQUE or primary-key constraint (the caller says which request lost). */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

/**
 * Runs `work` in one write transaction; any throw rolls everything back. The work receives the transaction, and
 * every statement the callback's async context executes — including ones through repositories built on `db` —
 * joins it (see `ScopedClient`).
 */
export async function runInTransaction<T>(db: Client, work: (txn: Transaction) => Promise<T>): Promise<T> {
  const txn = await db.transaction("write");
  try {
    const result = await transactionScope.run(txn, () => work(txn));
    await txn.commit();
    return result;
  } catch (error) {
    if (!txn.closed) await txn.rollback();
    throw error;
  }
}
