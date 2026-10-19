import { z } from "zod";

import type { Database } from "./database.js";

const TokenRow = z.object({
  id: z.string(),
  account_id: z.string(),
  expires_at: z.number().int(),
  used_at: z.number().int().nullable(),
  revoked_at: z.number().int().nullable(),
});

export interface StoredRefreshToken {
  id: string;
  accountId: string;
  expiresAt: number;
  usedAt: number | null;
  revokedAt: number | null;
}

const SQL = {
  insert: "INSERT INTO refresh_tokens (id, account_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
  byHash: "SELECT id, account_id, expires_at, used_at, revoked_at FROM refresh_tokens WHERE token_hash = ?",
  markUsed: "UPDATE refresh_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL",
  revoke: "UPDATE refresh_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
  revokeAll: "UPDATE refresh_tokens SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL",
  purge: "DELETE FROM refresh_tokens WHERE expires_at < ?",
};

/** Refresh tokens, kept only as SHA-256 hashes (docs/03 section 7.12). */
export function createRefreshTokenRepository(db: Database) {
  return {
    insert: async (id: string, accountId: string, tokenHash: string, at: number, expiresAt: number): Promise<void> => {
      await db.execute({ sql: SQL.insert, args: [id, accountId, tokenHash, at, expiresAt] });
    },
    findByHash: async (tokenHash: string): Promise<StoredRefreshToken | undefined> => {
      const row = (await db.execute({ sql: SQL.byHash, args: [tokenHash] })).rows[0];
      if (row === undefined) return undefined;
      const r = TokenRow.parse(row);
      return { id: r.id, accountId: r.account_id, expiresAt: r.expires_at, usedAt: r.used_at, revokedAt: r.revoked_at };
    },
    /** True only for the first use; a second caller loses the race and gets false. */
    markUsed: async (id: string, at: number): Promise<boolean> =>
      (await db.execute({ sql: SQL.markUsed, args: [at, id] })).rowsAffected > 0,
    revoke: async (id: string, at: number): Promise<void> => {
      await db.execute({ sql: SQL.revoke, args: [at, id] });
    },
    revokeAll: async (accountId: string, at: number): Promise<void> => {
      await db.execute({ sql: SQL.revokeAll, args: [at, accountId] });
    },
    purgeExpired: async (now: number): Promise<void> => {
      await db.execute({ sql: SQL.purge, args: [now] });
    },
  };
}

export type RefreshTokenRepository = ReturnType<typeof createRefreshTokenRepository>;
