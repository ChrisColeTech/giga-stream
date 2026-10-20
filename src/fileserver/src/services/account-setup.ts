import { createAccountCollectionRepository } from "../store/account-collection-repository.js";
import { createAccountDataRepository } from "../store/account-data-repository.js";
import type { AdminDatabase } from "../store/admin-database.js";
import { createAccountRepository } from "../store/account-repository.js";
import { createAccountWatchRepository } from "../store/account-watch-repository.js";
import { createAccountDataService } from "./account-data-service.js";
import { createAccountService } from "./account-service.js";

/** The account domain composition over the one admin Turso client (docs/64 section 2). */
export function createAccountServices(database: AdminDatabase, secret: string, now: () => number) {
  if (secret.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
  return {
    accountAuth: createAccountService({ accounts: createAccountRepository(database), secret, now }),
    accountData: createAccountDataService({
      data: createAccountDataRepository(database),
      collections: createAccountCollectionRepository(database),
      watches: createAccountWatchRepository(database),
      now,
    }),
  };
}
