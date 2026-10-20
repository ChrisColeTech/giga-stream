import { z } from "zod";

import type { AdminDatabase } from "./admin-database.js";

const SettingsRow = z.object({ settings: z.string(), updated_at: z.coerce.number().int() });
const FavoriteRow = z.object({
  ref_kind: z.enum(["title", "local"]), ref_id: z.string(), created_at: z.coerce.number().int(),
});

export function createAccountDataRepository(database: AdminDatabase) {
  return {
    async settings(accountId: string): Promise<{ value: unknown; updatedAt?: number }> {
      const raw = (await database.execute({
        sql: "SELECT settings, updated_at FROM user_settings WHERE account_id = ?", args: [accountId],
      })).rows[0];
      if (raw === undefined) return { value: {} };
      const row = SettingsRow.parse(raw);
      try { return { value: JSON.parse(row.settings) as unknown, updatedAt: row.updated_at }; }
      catch { return { value: {}, updatedAt: row.updated_at }; }
    },
    async writeSettings(accountId: string, value: unknown, at: number): Promise<void> {
      await database.execute({
        sql: `INSERT INTO user_settings (account_id, settings, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(account_id) DO UPDATE SET settings = excluded.settings, updated_at = excluded.updated_at`,
        args: [accountId, JSON.stringify(value), at],
      });
    },
    async favorites(accountId: string) {
      const rows = await database.execute({
        sql: `SELECT ref_kind, ref_id, created_at FROM user_favorites WHERE account_id = ?
          ORDER BY created_at, ref_kind, ref_id`, args: [accountId],
      });
      return rows.rows.map((raw) => {
        const row = FavoriteRow.parse(raw);
        return { ref: { kind: row.ref_kind, id: row.ref_id }, favorite: true as const, createdAt: row.created_at };
      });
    },
    async setFavorite(accountId: string, kind: "title" | "local", id: string, favorite: boolean, at: number) {
      if (favorite) {
        await database.execute({
          sql: `INSERT OR IGNORE INTO user_favorites (account_id, ref_kind, ref_id, created_at)
            VALUES (?, ?, ?, ?)`, args: [accountId, kind, id, at],
        });
      } else {
        await database.execute({
          sql: "DELETE FROM user_favorites WHERE account_id = ? AND ref_kind = ? AND ref_id = ?",
          args: [accountId, kind, id],
        });
      }
      return { ref: { kind, id }, favorite };
    },
  };
}

export type AccountDataRepository = ReturnType<typeof createAccountDataRepository>;
