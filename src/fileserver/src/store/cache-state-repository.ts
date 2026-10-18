import { z } from "zod";

import type { CacheDataset, CacheStateRow, SyncStamp } from "../types/backend-cache.js";
import type { Database } from "./database.js";
import { inTransaction } from "./transaction.js";

const Row = z.object({
  dataset: z.enum(["channels", "titles"]),
  source_key: z.string(),
  synced_at: z.number().nullable(),
  attempted_at: z.number().nullable(),
  error_code: z.string().nullable(),
  revision: z.number().nullable(),
  run: z.number(),
});

export interface CacheStateRepository {
  get(dataset: CacheDataset): CacheStateRow | undefined;
  /** Stamp an attempt (creating the row when absent); keeps the last good sync's facts. */
  begin(dataset: CacheDataset, sourceKey: string, attemptedAt: number): void;
  /** The next run number of a dataset (the titles sweep clock). */
  nextRun(dataset: CacheDataset): number;
  /** Run `work` and stamp the dataset synced in the same transaction; `work` must not open one. */
  commitSynced(dataset: CacheDataset, stamp: SyncStamp, work: () => void): void;
  /** A failed or cut-off sync: only the error code changes. */
  markFailed(dataset: CacheDataset, errorCode: string): void;
  /** A different backend: every cached row and every state row goes (one transaction). */
  purgeAll(): void;
}

export function createCacheStateRepository(db: Database): CacheStateRepository {
  const select = db.prepare("SELECT * FROM cache_state WHERE dataset = ?");
  const begin = db.prepare(
    `INSERT INTO cache_state (dataset, source_key, attempted_at) VALUES (?, ?, ?)
     ON CONFLICT (dataset) DO UPDATE SET attempted_at = excluded.attempted_at`,
  );
  const bumpRun = db.prepare("UPDATE cache_state SET run = run + 1 WHERE dataset = ? RETURNING run");
  const synced = db.prepare(
    `UPDATE cache_state SET source_key = ?, synced_at = ?, error_code = NULL, revision = ? WHERE dataset = ?`,
  );
  const failed = db.prepare("UPDATE cache_state SET error_code = ? WHERE dataset = ?");
  const PURGED_TABLES = ["cached_channels", "cached_titles", "cached_genres", "cache_state"];

  return {
    get(dataset) {
      const parsed = Row.safeParse(select.get(dataset));
      if (!parsed.success) return undefined;
      const row = parsed.data;
      return {
        dataset: row.dataset,
        sourceKey: row.source_key,
        syncedAt: row.synced_at,
        attemptedAt: row.attempted_at,
        errorCode: row.error_code,
        revision: row.revision,
        run: row.run,
      };
    },

    begin(dataset, sourceKey, attemptedAt) {
      begin.run(dataset, sourceKey, attemptedAt);
    },

    nextRun(dataset) {
      return z.object({ run: z.number() }).parse(bumpRun.get(dataset)).run;
    },

    commitSynced(dataset, stamp, work) {
      inTransaction(db, () => {
        work();
        synced.run(stamp.sourceKey, stamp.syncedAt, stamp.revision, dataset);
      });
    },

    markFailed(dataset, errorCode) {
      failed.run(errorCode, dataset);
    },

    purgeAll() {
      inTransaction(db, () => {
        for (const table of PURGED_TABLES) db.exec(`DELETE FROM ${table}`);
      });
    },
  };
}
