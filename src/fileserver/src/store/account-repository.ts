import type { Transaction } from "@libsql/client";
import { z } from "zod";

import type { Account } from "../types/account.js";
import type { AdminDatabase } from "./admin-database.js";

const Row = z.object({
  id: z.string(), username: z.string(), kind: z.enum(["admin", "user"]), password_hash: z.string(),
  disabled: z.coerce.number().int(), session_version: z.coerce.number().int(),
  created_at: z.coerce.number().int(), updated_at: z.coerce.number().int(),
  last_sign_in_at: z.coerce.number().int().nullable(), security_question: z.coerce.number().int().nullable(),
  security_answer_hash: z.string().nullable(),
});
const TokenRow = z.object({
  id: z.string(), account_id: z.string(), expires_at: z.coerce.number().int(),
  used_at: z.coerce.number().int().nullable(), revoked_at: z.coerce.number().int().nullable(),
});

export interface StoredAccount {
  account: Account;
  passwordHash: string;
  sessionVersion: number;
  securityQuestion: number | null;
  securityAnswerHash: string | null;
}

const COLUMNS = `id, username, kind, password_hash, disabled, session_version, created_at, updated_at,
  last_sign_in_at, security_question, security_answer_hash`;

function stored(raw: unknown): StoredAccount {
  const row = Row.parse(raw);
  return {
    account: {
      id: row.id, username: row.username, kind: row.kind, disabled: row.disabled === 1,
      createdAt: row.created_at, updatedAt: row.updated_at,
      ...(row.last_sign_in_at !== null && { lastSignInAt: row.last_sign_in_at }),
      securityQuestionSet: row.security_question !== null && row.security_answer_hash !== null,
    },
    passwordHash: row.password_hash, sessionVersion: row.session_version,
    securityQuestion: row.security_question, securityAnswerHash: row.security_answer_hash,
  };
}

async function transaction<T>(database: AdminDatabase, work: (txn: Transaction) => Promise<T>): Promise<T> {
  const txn = await database.transaction("write");
  try {
    const answer = await work(txn);
    await txn.commit();
    return answer;
  } catch (error) {
    if (!txn.closed) await txn.rollback();
    throw error;
  }
}

export function createAccountRepository(database: AdminDatabase) {
  const findWith = async (sql: string, value: string): Promise<StoredAccount | undefined> => {
    const row = (await database.execute({ sql, args: [value] })).rows[0];
    return row === undefined ? undefined : stored(row);
  };
  return {
    find: (id: string) => findWith(`SELECT ${COLUMNS} FROM admin_accounts WHERE id = ?`, id),
    findByUsername: (username: string) =>
      findWith(`SELECT ${COLUMNS} FROM admin_accounts WHERE username_key = ?`, username.trim().toLowerCase()),
    async register(input: {
      id: string; username: string; passwordHash: string; question: number; answerHash: string; at: number;
      refreshId: string; refreshHash: string; refreshExpiresAt: number;
    }): Promise<StoredAccount> {
      await transaction(database, async (txn) => {
        await txn.execute({
          sql: `INSERT INTO admin_accounts (id, username, username_key, kind, password_hash, disabled,
            created_at, updated_at, security_question, security_answer_hash) VALUES (?, ?, ?, 'user', ?, 0, ?, ?, ?, ?)`,
          args: [input.id, input.username, input.username.toLowerCase(), input.passwordHash,
            input.at, input.at, input.question, input.answerHash],
        });
        await txn.execute({
          sql: "INSERT INTO refresh_tokens (id, account_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
          args: [input.refreshId, input.id, input.refreshHash, input.at, input.refreshExpiresAt],
        });
      });
      const created = await findWith(`SELECT ${COLUMNS} FROM admin_accounts WHERE id = ?`, input.id);
      if (created === undefined) throw new Error("registered account missing");
      return created;
    },
    async updateUsername(id: string, username: string, at: number): Promise<StoredAccount | undefined> {
      await database.execute({
        sql: "UPDATE admin_accounts SET username = ?, username_key = ?, updated_at = ? WHERE id = ?",
        args: [username, username.toLowerCase(), at, id],
      });
      return findWith(`SELECT ${COLUMNS} FROM admin_accounts WHERE id = ?`, id);
    },
    recordSignIn: async (id: string, at: number): Promise<void> => {
      await database.execute({ sql: "UPDATE admin_accounts SET last_sign_in_at = ? WHERE id = ?", args: [at, id] });
    },
    insertRefresh: async (id: string, accountId: string, hash: string, at: number, expiresAt: number): Promise<void> => {
      await database.execute({
        sql: "INSERT INTO refresh_tokens (id, account_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
        args: [id, accountId, hash, at, expiresAt],
      });
    },
    async rotateRefresh(input: {
      oldHash: string; id: string; newHash: string; at: number; expiresAt: number;
    }): Promise<{ kind: "ok"; account: StoredAccount } | { kind: "invalid" | "reused" }> {
      return transaction(database, async (txn) => {
        const tokenRaw = (await txn.execute({
          sql: "SELECT id, account_id, expires_at, used_at, revoked_at FROM refresh_tokens WHERE token_hash = ?",
          args: [input.oldHash],
        })).rows[0];
        if (tokenRaw === undefined) return { kind: "invalid" };
        const token = TokenRow.parse(tokenRaw);
        if (token.used_at !== null) {
          await txn.execute({
            sql: "UPDATE admin_accounts SET session_version = session_version + 1 WHERE id = ?",
            args: [token.account_id],
          });
          await txn.execute({
            sql: "UPDATE refresh_tokens SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL",
            args: [input.at, token.account_id],
          });
          return { kind: "reused" };
        }
        if (token.revoked_at !== null || token.expires_at <= input.at) return { kind: "invalid" };
        const accountRaw = (await txn.execute({
          sql: `SELECT ${COLUMNS} FROM admin_accounts WHERE id = ?`, args: [token.account_id],
        })).rows[0];
        if (accountRaw === undefined) return { kind: "invalid" };
        const account = stored(accountRaw);
        if (account.account.disabled) return { kind: "invalid" };
        const used = await txn.execute({
          sql: "UPDATE refresh_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL", args: [input.at, token.id],
        });
        if (used.rowsAffected !== 1) {
          await txn.execute({
            sql: "UPDATE admin_accounts SET session_version = session_version + 1 WHERE id = ?",
            args: [token.account_id],
          });
          await txn.execute({
            sql: "UPDATE refresh_tokens SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL",
            args: [input.at, token.account_id],
          });
          return { kind: "reused" };
        }
        await txn.execute({
          sql: "INSERT INTO refresh_tokens (id, account_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
          args: [input.id, token.account_id, input.newHash, input.at, input.expiresAt],
        });
        return { kind: "ok", account };
      });
    },
    async logout(hash: string, at: number): Promise<boolean> {
      const result = await database.execute({
        sql: "UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL", args: [at, hash],
      });
      return result.rowsAffected > 0;
    },
    async replacePassword(id: string, hash: string, at: number): Promise<void> {
      await transaction(database, async (txn) => {
        await txn.execute({
          sql: `UPDATE admin_accounts SET password_hash = ?, updated_at = ?, session_version = session_version + 1
            WHERE id = ?`, args: [hash, at, id],
        });
        await txn.execute({
          sql: "UPDATE refresh_tokens SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL", args: [at, id],
        });
      });
    },
  };
}

export type AccountRepository = ReturnType<typeof createAccountRepository>;
