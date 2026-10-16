import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

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

/** Refresh tokens, kept only as SHA-256 hashes (docs/03 section 7.12). */
export function createRefreshTokenRepository(db: DatabaseSync) {
  const insert = db.prepare(
    "INSERT INTO refresh_tokens (id, account_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
  );
  const byHash = db.prepare("SELECT id, account_id, expires_at, used_at, revoked_at FROM refresh_tokens WHERE token_hash = ?");
  const markUsed = db.prepare("UPDATE refresh_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL");
  const revoke = db.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL");
  const revokeAll = db.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL");
  const purge = db.prepare("DELETE FROM refresh_tokens WHERE expires_at < ?");

  return {
    insert(id: string, accountId: string, tokenHash: string, at: number, expiresAt: number): void {
      insert.run(id, accountId, tokenHash, at, expiresAt);
    },
    findByHash(tokenHash: string): StoredRefreshToken | undefined {
      const row = byHash.get(tokenHash);
      if (row === undefined) return undefined;
      const r = TokenRow.parse(row);
      return { id: r.id, accountId: r.account_id, expiresAt: r.expires_at, usedAt: r.used_at, revokedAt: r.revoked_at };
    },
    /** True only for the first use; a second caller loses the race and gets false. */
    markUsed: (id: string, at: number): boolean => Number(markUsed.run(at, id).changes) > 0,
    revoke: (id: string, at: number): void => void revoke.run(at, id),
    revokeAll: (accountId: string, at: number): void => void revokeAll.run(at, accountId),
    purgeExpired: (now: number): void => void purge.run(now),
  };
}

export type RefreshTokenRepository = ReturnType<typeof createRefreshTokenRepository>;
