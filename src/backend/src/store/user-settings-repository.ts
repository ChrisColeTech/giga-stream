import { z } from "zod";

import type { Database } from "./database.js";

const SettingsRow = z.object({ settings: z.string(), updated_at: z.number().int() });

/** One account's settings document as it is stored: the JSON text exactly as it was written. */
export interface StoredUserSettings {
  settings: string;
  updatedAt: number;
}

const SQL = {
  one: "SELECT settings, updated_at FROM user_settings WHERE account_id = ?",
  upsert: `
    INSERT INTO user_settings (account_id, settings, updated_at) VALUES (?, ?, ?)
    ON CONFLICT (account_id) DO UPDATE SET settings = excluded.settings, updated_at = excluded.updated_at`,
};

/** The signed-in account's settings document (docs/62 section 3.1): one row per account, written whole. */
export function createUserSettingsRepository(db: Database) {
  return {
    find: async (accountId: string): Promise<StoredUserSettings | undefined> => {
      const row = (await db.execute({ sql: SQL.one, args: [accountId] })).rows[0];
      if (row === undefined) return undefined;
      const r = SettingsRow.parse(row);
      return { settings: r.settings, updatedAt: r.updated_at };
    },
    upsert: async (accountId: string, settings: string, at: number): Promise<void> => {
      await db.execute({ sql: SQL.upsert, args: [accountId, settings, at] });
    },
  };
}

export type UserSettingsRepository = ReturnType<typeof createUserSettingsRepository>;
