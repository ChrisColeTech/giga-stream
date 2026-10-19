import { z } from "zod";

import type { Database } from "./database.js";

const StateRow = z.object({ settings: z.string(), shell: z.string(), updated_at: z.number().int() });

/** One account's two documents as they are stored: JSON text, exactly as they were written. */
export interface StoredAccountState {
  settings: string;
  shell: string;
  updatedAt: number;
}

const SQL = {
  one: "SELECT settings, shell, updated_at FROM admin_ui_state WHERE account_id = ?",
  upsert: `
    INSERT INTO admin_ui_state (account_id, settings, shell, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (account_id) DO UPDATE SET settings = excluded.settings, shell = excluded.shell,
      updated_at = excluded.updated_at`,
};

/** The per-account settings and shell rows (docs/29 section 12.2): one row per account, both written together. */
export function createUiStateRepository(db: Database) {
  return {
    find: async (accountId: string): Promise<StoredAccountState | undefined> => {
      const row = (await db.execute({ sql: SQL.one, args: [accountId] })).rows[0];
      if (row === undefined) return undefined;
      const r = StateRow.parse(row);
      return { settings: r.settings, shell: r.shell, updatedAt: r.updated_at };
    },
    upsert: async (accountId: string, sections: { settings: string; shell: string }, at: number): Promise<void> => {
      await db.execute({ sql: SQL.upsert, args: [accountId, sections.settings, sections.shell, at] });
    },
  };
}

export type UiStateRepository = ReturnType<typeof createUiStateRepository>;
