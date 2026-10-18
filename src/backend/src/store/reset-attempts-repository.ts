import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const AttemptRow = z.object({
  failed: z.number().int(),
  locked_until: z.number().int().nullable(),
});

/** The wrong answers counted against one normalised username, and the lock they set (docs/40 section 2.5). */
export interface ResetAttempt {
  failed: number;
  lockedUntil: number | null;
}

/** The `reset_attempts` table: keyed by the normalised username, known or unknown, so every username locks alike. */
export function createResetAttemptsRepository(db: DatabaseSync) {
  const byKey = db.prepare("SELECT failed, locked_until FROM reset_attempts WHERE username_key = ?");
  const upsert = db.prepare(`INSERT INTO reset_attempts (username_key, failed, locked_until) VALUES (?, ?, ?)
    ON CONFLICT (username_key) DO UPDATE SET failed = excluded.failed, locked_until = excluded.locked_until`);
  const remove = db.prepare("DELETE FROM reset_attempts WHERE username_key = ?");

  return {
    find(usernameKey: string): ResetAttempt | undefined {
      const row = byKey.get(usernameKey);
      if (row === undefined) return undefined;
      const r = AttemptRow.parse(row);
      return { failed: r.failed, lockedUntil: r.locked_until };
    },
    recordFailure: (usernameKey: string, failed: number, lockedUntil: number | null): void =>
      void upsert.run(usernameKey, failed, lockedUntil),
    remove: (usernameKey: string): void => void remove.run(usernameKey),
  };
}

export type ResetAttemptsRepository = ReturnType<typeof createResetAttemptsRepository>;
