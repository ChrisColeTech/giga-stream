import { z } from "zod";

import type { RefKind } from "../types/user-collection.js";
import type { Database } from "./database.js";

const CollectionRow = z.object({
  id: z.string(),
  account_id: z.string(),
  name: z.string(),
  type: z.enum(["movie", "tv", "local"]),
  created_at: z.number().int(),
  updated_at: z.number().int(),
});

const CountRow = z.object({ n: z.number() });
const MembershipRow = z.object({ collection_id: z.string() });

/** One collection as it is stored; the account it belongs to never leaves the store. */
export interface StoredUserCollection {
  id: string;
  accountId: string;
  name: string;
  type: "movie" | "tv" | "local";
  createdAt: number;
  updatedAt: number;
}

const COLLECTION_COLUMNS = "id, account_id, name, type, created_at, updated_at";

const SQL = {
  all: `SELECT ${COLLECTION_COLUMNS} FROM user_collections WHERE account_id = ? ORDER BY name`,
  one: `SELECT ${COLLECTION_COLUMNS} FROM user_collections WHERE id = ? AND account_id = ?`,
  insert: "INSERT INTO user_collections (id, account_id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  update: "UPDATE user_collections SET name = ?, type = ?, updated_at = ? WHERE id = ? AND account_id = ?",
  remove: "DELETE FROM user_collections WHERE id = ? AND account_id = ?",
  itemCount: "SELECT COUNT(*) AS n FROM user_collection_items WHERE collection_id = ?",
  addItem: `
    INSERT OR IGNORE INTO user_collection_items (collection_id, ref_kind, ref_id, added_at) VALUES (?, ?, ?, ?)`,
  removeItem: "DELETE FROM user_collection_items WHERE collection_id = ? AND ref_kind = ? AND ref_id = ?",
  memberships: `
    SELECT c.id AS collection_id FROM user_collections c
    JOIN user_collection_items i ON i.collection_id = c.id AND i.ref_kind = ? AND i.ref_id = ?
    WHERE c.account_id = ? ORDER BY c.name`,
};

/**
 * The account's collections and their manual members (docs/62 section 3.1). Every statement filters on the
 * account, so a foreign id reads as absent and cross-account access is impossible by construction (docs/62
 * section 3.3).
 */
export function createUserCollectionRepository(db: Database) {
  const toStored = (row: unknown): StoredUserCollection => {
    const r = CollectionRow.parse(row);
    return {
      id: r.id,
      accountId: r.account_id,
      name: r.name,
      type: r.type,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  };

  return {
    list: async (accountId: string): Promise<StoredUserCollection[]> =>
      (await db.execute({ sql: SQL.all, args: [accountId] })).rows.map(toStored),
    /** The account's own row with this id, or undefined: another account's id is simply not there. */
    find: async (accountId: string, id: string): Promise<StoredUserCollection | undefined> => {
      const row = (await db.execute({ sql: SQL.one, args: [id, accountId] })).rows[0];
      return row === undefined ? undefined : toStored(row);
    },
    insert: async (collection: StoredUserCollection): Promise<void> => {
      await db.execute({
        sql: SQL.insert,
        args: [
          collection.id, collection.accountId, collection.name, collection.type,
          collection.createdAt, collection.updatedAt,
        ],
      });
    },
    update: async (accountId: string, id: string, name: string, type: string, at: number): Promise<void> => {
      await db.execute({ sql: SQL.update, args: [name, type, at, id, accountId] });
    },
    remove: async (accountId: string, id: string): Promise<boolean> =>
      (await db.execute({ sql: SQL.remove, args: [id, accountId] })).rowsAffected > 0,
    itemCount: async (id: string): Promise<number> =>
      CountRow.parse((await db.execute({ sql: SQL.itemCount, args: [id] })).rows[0]).n,
    /** Idempotent: an existing member keeps its added_at. */
    addItem: async (id: string, refKind: RefKind, refId: string, at: number): Promise<void> => {
      await db.execute({ sql: SQL.addItem, args: [id, refKind, refId, at] });
    },
    removeItem: async (id: string, refKind: RefKind, refId: string): Promise<boolean> =>
      (await db.execute({ sql: SQL.removeItem, args: [id, refKind, refId] })).rowsAffected > 0,
    /** The account's collections that hold this item by hand, by name. */
    itemCollections: async (accountId: string, refKind: RefKind, refId: string): Promise<string[]> =>
      (await db.execute({ sql: SQL.memberships, args: [refKind, refId, accountId] })).rows.map(
        (row) => MembershipRow.parse(row).collection_id,
      ),
  };
}

export type UserCollectionRepository = ReturnType<typeof createUserCollectionRepository>;
