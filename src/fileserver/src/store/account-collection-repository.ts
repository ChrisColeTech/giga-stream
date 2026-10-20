import { z } from "zod";

import type { AdminDatabase } from "./admin-database.js";

const Row = z.object({
  id: z.string(), name: z.string(), type: z.enum(["movie", "tv", "local"]),
  created_at: z.coerce.number().int(), updated_at: z.coerce.number().int(), item_count: z.coerce.number().int(),
});

export interface AccountCollection {
  id: string;
  name: string;
  type: "movie" | "tv" | "local";
  itemCount: number;
  createdAt: number;
  updatedAt: number;
}

const SELECT = `SELECT c.id, c.name, c.type, c.created_at, c.updated_at,
  (SELECT COUNT(*) FROM user_collection_items i WHERE i.collection_id = c.id) AS item_count
  FROM user_collections c`;
const view = (raw: unknown): AccountCollection => {
  const row = Row.parse(raw);
  return {
    id: row.id, name: row.name, type: row.type, itemCount: row.item_count,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
};

export function createAccountCollectionRepository(database: AdminDatabase) {
  async function find(accountId: string, id: string): Promise<AccountCollection | undefined> {
    const raw = (await database.execute({
      sql: `${SELECT} WHERE c.account_id = ? AND c.id = ?`, args: [accountId, id],
    })).rows[0];
    return raw === undefined ? undefined : view(raw);
  }
  return {
    find,
    async list(accountId: string): Promise<AccountCollection[]> {
      const result = await database.execute({
        sql: `${SELECT} WHERE c.account_id = ? ORDER BY c.name COLLATE NOCASE, c.id`, args: [accountId],
      });
      return result.rows.map(view);
    },
    async insert(row: AccountCollection, accountId: string): Promise<void> {
      await database.execute({
        sql: `INSERT INTO user_collections (id, account_id, name, type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: [row.id, accountId, row.name, row.type, row.createdAt, row.updatedAt],
      });
    },
    async update(accountId: string, id: string, name: string, type: string, at: number): Promise<void> {
      await database.execute({
        sql: "UPDATE user_collections SET name = ?, type = ?, updated_at = ? WHERE account_id = ? AND id = ?",
        args: [name, type, at, accountId, id],
      });
    },
    async remove(accountId: string, id: string): Promise<boolean> {
      const result = await database.execute({
        sql: "DELETE FROM user_collections WHERE account_id = ? AND id = ?", args: [accountId, id],
      });
      return result.rowsAffected > 0;
    },
    async addItem(id: string, kind: string, itemId: string, at: number): Promise<void> {
      await database.execute({
        sql: `INSERT OR IGNORE INTO user_collection_items (collection_id, ref_kind, ref_id, added_at)
          VALUES (?, ?, ?, ?)`, args: [id, kind, itemId, at],
      });
    },
    async removeItem(id: string, kind: string, itemId: string): Promise<void> {
      await database.execute({
        sql: "DELETE FROM user_collection_items WHERE collection_id = ? AND ref_kind = ? AND ref_id = ?",
        args: [id, kind, itemId],
      });
    },
    async memberships(accountId: string, kind: string, itemId: string): Promise<string[]> {
      const result = await database.execute({
        sql: `SELECT c.id FROM user_collections c JOIN user_collection_items i ON i.collection_id = c.id
          WHERE c.account_id = ? AND i.ref_kind = ? AND i.ref_id = ? ORDER BY c.name COLLATE NOCASE, c.id`,
        args: [accountId, kind, itemId],
      });
      return result.rows.map((raw) => z.object({ id: z.string() }).parse(raw).id);
    },
  };
}

export type AccountCollectionRepository = ReturnType<typeof createAccountCollectionRepository>;
