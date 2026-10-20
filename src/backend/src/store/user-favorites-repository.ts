import { z } from "zod";

import type { RefKind } from "../types/user-collection.js";
import type { Database } from "./database.js";

const FavoriteRow = z.object({
  ref_kind: z.enum(["title", "local"]),
  ref_id: z.string(),
  created_at: z.number().int(),
});

/** One favorite as it is stored: the ref and when the account put it there. */
export interface StoredFavorite {
  refKind: RefKind;
  refId: string;
  createdAt: number;
}

const SQL = {
  all: `
    SELECT ref_kind, ref_id, created_at FROM user_favorites WHERE account_id = ?
    ORDER BY created_at, ref_kind, ref_id`,
  one: "SELECT ref_kind FROM user_favorites WHERE account_id = ? AND ref_kind = ? AND ref_id = ?",
  add: `
    INSERT OR IGNORE INTO user_favorites (account_id, ref_kind, ref_id, created_at) VALUES (?, ?, ?, ?)`,
  remove: "DELETE FROM user_favorites WHERE account_id = ? AND ref_kind = ? AND ref_id = ?",
};

/**
 * The account's favorites (docs/62 section 3.1): a flat additive set, every query scoped to its account, so
 * no route can reach another account's rows.
 */
export function createUserFavoritesRepository(db: Database) {
  return {
    list: async (accountId: string): Promise<StoredFavorite[]> =>
      (await db.execute({ sql: SQL.all, args: [accountId] })).rows.map((row) => {
        const r = FavoriteRow.parse(row);
        return { refKind: r.ref_kind, refId: r.ref_id, createdAt: r.created_at };
      }),
    has: async (accountId: string, refKind: RefKind, refId: string): Promise<boolean> =>
      (await db.execute({ sql: SQL.one, args: [accountId, refKind, refId] })).rows.length > 0,
    /** Idempotent both ways: an existing row keeps its created_at, so re-putting does not move it. */
    add: async (accountId: string, refKind: RefKind, refId: string, at: number): Promise<void> => {
      await db.execute({ sql: SQL.add, args: [accountId, refKind, refId, at] });
    },
    remove: async (accountId: string, refKind: RefKind, refId: string): Promise<boolean> =>
      (await db.execute({ sql: SQL.remove, args: [accountId, refKind, refId] })).rowsAffected > 0,
  };
}

export type UserFavoritesRepository = ReturnType<typeof createUserFavoritesRepository>;
