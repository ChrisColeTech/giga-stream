import { z } from "zod";

import type { Database } from "./database.js";

const ShellRow = z.object({ value: z.string() });

export interface ShellStateRepository {
  /** The stored record as parsed JSON, or `undefined` when none was ever written or it is corrupt. */
  read(): unknown;
  write(value: unknown, at: number): void;
}

export function createShellStateRepository(db: Database): ShellStateRepository {
  const select = db.prepare("SELECT value FROM shell_state WHERE id = 1");
  const upsert = db.prepare(
    `INSERT INTO shell_state (id, value, updated_at) VALUES (1, ?, ?)
     ON CONFLICT (id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  );

  return {
    read() {
      const row = ShellRow.safeParse(select.get());
      if (!row.success) return undefined;
      try {
        return JSON.parse(row.data.value);
      } catch {
        return undefined;
      }
    },

    write(value, at) {
      upsert.run(JSON.stringify(value), at);
    },
  };
}
