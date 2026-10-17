import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const StateRow = z.object({ settings: z.string(), shell: z.string(), updated_at: z.number().int() });

/** One account's two documents as they are stored: JSON text, exactly as they were written. */
export interface StoredAccountState {
  settings: string;
  shell: string;
  updatedAt: number;
}

/** The per-account settings and shell rows (docs/29 section 12.2): one row per account, both written together. */
export function createUiStateRepository(db: DatabaseSync) {
  const one = db.prepare("SELECT settings, shell, updated_at FROM admin_ui_state WHERE account_id = ?");
  const upsert = db.prepare(`
    INSERT INTO admin_ui_state (account_id, settings, shell, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (account_id) DO UPDATE SET settings = excluded.settings, shell = excluded.shell,
      updated_at = excluded.updated_at`);

  return {
    find(accountId: string): StoredAccountState | undefined {
      const row = one.get(accountId);
      if (row === undefined) return undefined;
      const r = StateRow.parse(row);
      return { settings: r.settings, shell: r.shell, updatedAt: r.updated_at };
    },
    upsert(accountId: string, sections: { settings: string; shell: string }, at: number): void {
      upsert.run(accountId, sections.settings, sections.shell, at);
    },
  };
}

export type UiStateRepository = ReturnType<typeof createUiStateRepository>;
