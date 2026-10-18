import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const AttemptRow = z.object({
  failed: z.number().int(),
  locked_until: z.number().int().nullable(),
});

/** The wrong answers counted against one normalised email, and the lock they set (docs/40 section 2.5). */
export interface ResetAttempt {
  failed: number;
  lockedUntil: number | null;
}

/** The `reset_attempts` table: keyed by the normalised email, known or unknown, so every email locks alike. */
export function createResetAttemptsRepository(db: DatabaseSync) {
  const byKey = db.prepare("SELECT failed, locked_until FROM reset_attempts WHERE email_key = ?");
  const upsert = db.prepare(`INSERT INTO reset_attempts (email_key, failed, locked_until) VALUES (?, ?, ?)
    ON CONFLICT (email_key) DO UPDATE SET failed = excluded.failed, locked_until = excluded.locked_until`);
  const remove = db.prepare("DELETE FROM reset_attempts WHERE email_key = ?");

  return {
    find(emailKey: string): ResetAttempt | undefined {
      const row = byKey.get(emailKey);
      if (row === undefined) return undefined;
      const r = AttemptRow.parse(row);
      return { failed: r.failed, lockedUntil: r.locked_until };
    },
    recordFailure: (emailKey: string, failed: number, lockedUntil: number | null): void =>
      void upsert.run(emailKey, failed, lockedUntil),
    remove: (emailKey: string): void => void remove.run(emailKey),
  };
}

export type ResetAttemptsRepository = ReturnType<typeof createResetAttemptsRepository>;
