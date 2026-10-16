import type { DatabaseSync } from "node:sqlite";

import { createAccountRepository } from "./account-repository.js";
import { createAuditRepository } from "./audit-repository.js";
import { createChannelRepository } from "./channel-repository.js";
import { openDatabase, runInTransaction } from "./database.js";
import { migrate } from "./migrate.js";
import { createProviderRepository } from "./provider-repository.js";
import { createRefreshTokenRepository } from "./refresh-token-repository.js";
import { createRevisionRepository } from "./revision-repository.js";
import { createTitleRepository } from "./title-repository.js";

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
    providers: createProviderRepository(db),
    titles: createTitleRepository(db),
    revisions: createRevisionRepository(db),
    accounts: createAccountRepository(db),
    refreshTokens: createRefreshTokenRepository(db),
    audit: createAuditRepository(db),
    transaction: <T>(work: () => T): T => runInTransaction(db, work),
    close: (): void => db.close(),
  };
}

export type Store = ReturnType<typeof createStore>;
