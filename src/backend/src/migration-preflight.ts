import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "./config.js";
import { DATABASE_FILE_NAME } from "./constants/deployment.js";
import { AppError } from "./constants/errors.js";
import { createStore } from "./store/store.js";

interface MigrationStore {
  close(): void;
}

export type MigrationStoreFactory = (file: string) => Promise<MigrationStore>;

/** Opens the backend's configured store, lets its composition root migrate it, then releases the client. */
export async function runMigrationPreflight(
  dataDir: string = config.DATA_DIR,
  create: MigrationStoreFactory = createStore,
  report: (message: string) => void = console.info,
): Promise<void> {
  // createStore closes its database when opening or migration fails; this entry owns it after creation succeeds.
  const store = await create(path.join(dataDir, DATABASE_FILE_NAME));
  try {
    report("Database migrations are current.");
  } finally {
    store.close();
  }
}

function reportFailure(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  if (error instanceof AppError && error.details !== undefined) console.error(JSON.stringify(error.details));
  if (config.TURSO_DATABASE_URL === "") return;
  try {
    console.error(`database host: ${new URL(config.TURSO_DATABASE_URL).host}`);
  } catch {
    console.error("database host: invalid TURSO_DATABASE_URL");
  }
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  try {
    await runMigrationPreflight();
  } catch (error) {
    reportFailure(error);
    process.exitCode = 1;
  }
}
