import { z } from "zod";

import type { Database } from "./database.js";
import { inTransaction } from "./transaction.js";

const SettingRow = z.object({ key: z.string(), value: z.string() });

export interface SettingsRepository {
  /** Every stored row as `key -> parsed JSON`. Unparseable rows are skipped (they read as defaults). */
  readAll(): Map<string, unknown>;
  /** Upsert all entries in one transaction. */
  writeMany(entries: ReadonlyMap<string, unknown>, at: number): void;
}

export function createSettingsRepository(db: Database): SettingsRepository {
  const selectAll = db.prepare("SELECT key, value FROM settings");
  const upsert = db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  );

  return {
    readAll() {
      const values = new Map<string, unknown>();
      for (const raw of selectAll.all()) {
        const row = SettingRow.safeParse(raw);
        if (!row.success) continue;
        try {
          values.set(row.data.key, JSON.parse(row.data.value));
        } catch {
          // A corrupt JSON value is treated as absent.
        }
      }
      return values;
    },

    writeMany(entries, at) {
      inTransaction(db, () => {
        for (const [key, value] of entries) upsert.run(key, JSON.stringify(value), at);
      });
    },
  };
}
