import type { Transaction } from "@libsql/client";

import { createAccountRepository } from "./account-repository.js";
import { createAuditRepository } from "./audit-repository.js";
import { createChannelHealth } from "./channel-health.js";
import { createChannelRepository } from "./channel-repository.js";
import { openDatabase, runInTransaction, type Database } from "./database.js";
import { createDeletedTitleRepository } from "./deleted-title-repository.js";
import { createJobRepository } from "./job-repository.js";
import { migrate } from "./migrate.js";
import { createPlaylistRepository } from "./playlist-repository.js";
import { createProviderRepository } from "./provider-repository.js";
import { createRefreshTokenRepository } from "./refresh-token-repository.js";
import { createRevisionRepository } from "./revision-repository.js";
import { createTitleRepository } from "./title-repository.js";
import { createUiStateRepository } from "./ui-state-repository.js";

/**
 * The store composition root: opens and migrates the one database, and hands out its repositories. The read is the
 * startup's async init: the migrations have run before the first request is answered.
 */
export async function createStore(file: string) {
  const db: Database = await openDatabase(file);
  try {
    await migrate(db);
  } catch (error) {
    db.close();
    throw error;
  }
  return {
    channels: createChannelRepository(db),
    health: createChannelHealth(db),
    providers: createProviderRepository(db),
    titles: createTitleRepository(db),
    deletedTitles: createDeletedTitleRepository(db),
    playlists: createPlaylistRepository(db),
    jobs: createJobRepository(db),
    revisions: createRevisionRepository(db),
    accounts: createAccountRepository(db),
    refreshTokens: createRefreshTokenRepository(db),
    audit: createAuditRepository(db),
    uiState: createUiStateRepository(db),
    transaction: <T>(work: (txn: Transaction) => Promise<T>): Promise<T> => runInTransaction(db, work),
    close: (): void => db.close(),
  };
}

export type Store = Awaited<ReturnType<typeof createStore>>;
