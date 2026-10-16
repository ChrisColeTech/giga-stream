import type { DatabaseSync } from "node:sqlite";

import { createChannelRepository } from "./channel-repository.ts";
import { openDatabase, runInTransaction } from "./database.ts";
import { migrate } from "./migrate.ts";

/** The store composition root: opens and migrates the one database, and hands out its repositories. */
export function createStore(file: string) {
  const db: DatabaseSync = openDatabase(file);
  try {
    migrate(db);
  } catch (error) {
    db.close();
    throw error;
  }
  return {
    channels: createChannelRepository(db),
    transaction: <T>(work: () => T): T => runInTransaction(db, work),
    close: (): void => db.close(),
  };
}

export type Store = ReturnType<typeof createStore>;
