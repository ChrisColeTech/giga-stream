import { z } from "zod";

import type { Database } from "./database.js";
import type { AdminAccount } from "../types/account.js";

const AccountRow = z.object({
  id: z.string(),
  username: z.string(),
  password_hash: z.string(),
  disabled: z.number().int(),
  session_version: z.number().int(),
  created_at: z.number().int(),
  updated_at: z.number().int(),
  last_sign_in_at: z.number().int().nullable(),
  security_question: z.number().int().nullable(),
  security_answer_hash: z.string().nullable(),
});

/** A stored account, including what never leaves the backend (the hashes and the session version). */
export interface StoredAccount {
  account: AdminAccount;
  passwordHash: string;
  sessionVersion: number;
  /** The picklist number of the account's security question (docs/40 section 2.1), or null when none is set. */
  securityQuestion: number | null;
  securityAnswerHash: string | null;
}

function toStored(row: unknown): StoredAccount {
  const r = AccountRow.parse(row);
  return {
    account: {
      id: r.id,
      username: r.username,
      disabled: r.disabled === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      ...(r.last_sign_in_at !== null && { lastSignInAt: r.last_sign_in_at }),
      securityQuestionSet: r.security_question !== null && r.security_answer_hash !== null,
    },
    passwordHash: r.password_hash,
    sessionVersion: r.session_version,
    securityQuestion: r.security_question,
    securityAnswerHash: r.security_answer_hash,
  };
}

export interface AccountWrite {
  id: string;
  username: string;
  passwordHash: string;
  disabled: boolean;
}

const COLUMNS = `id, username, password_hash, disabled, session_version,
  created_at, updated_at, last_sign_in_at, security_question, security_answer_hash`;

const SQL = {
  byId: `SELECT ${COLUMNS} FROM admin_accounts WHERE id = ?`,
  byUsername: `SELECT ${COLUMNS} FROM admin_accounts WHERE username_key = ?`,
  all: `SELECT ${COLUMNS} FROM admin_accounts ORDER BY username_key`,
  count: "SELECT COUNT(*) AS n FROM admin_accounts",
  enabled: "SELECT COUNT(*) AS n FROM admin_accounts WHERE disabled = 0",
  insert: `INSERT INTO admin_accounts (id, username, username_key, password_hash, disabled,
    created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  update: `UPDATE admin_accounts SET username = ?, username_key = ?, password_hash = ?,
    disabled = ?, updated_at = ? WHERE id = ?`,
  bumpVersion: "UPDATE admin_accounts SET session_version = session_version + 1 WHERE id = ?",
  signedIn: "UPDATE admin_accounts SET last_sign_in_at = ? WHERE id = ?",
  setQuestion: "UPDATE admin_accounts SET security_question = ?, security_answer_hash = ?, updated_at = ? WHERE id = ?",
  remove: "DELETE FROM admin_accounts WHERE id = ?",
};

/** The admin accounts table (docs/03 section 7.11). Usernames are unique without case. */
export function createAccountRepository(db: Database) {
  const countOf = async (sql: string): Promise<number> =>
    z.object({ n: z.number() }).parse((await db.execute(sql)).rows[0]).n;

  return {
    find: async (id: string): Promise<StoredAccount | undefined> => {
      const row = (await db.execute({ sql: SQL.byId, args: [id] })).rows[0];
      return row === undefined ? undefined : toStored(row);
    },
    findByUsername: async (username: string): Promise<StoredAccount | undefined> => {
      const row = (await db.execute({ sql: SQL.byUsername, args: [username.toLowerCase()] })).rows[0];
      return row === undefined ? undefined : toStored(row);
    },
    list: async (): Promise<StoredAccount[]> => (await db.execute(SQL.all)).rows.map(toStored),
    count: (): Promise<number> => countOf(SQL.count),
    enabledCount: (): Promise<number> => countOf(SQL.enabled),
    async insert(a: AccountWrite, at: number): Promise<void> {
      await db.execute({
        sql: SQL.insert,
        args: [a.id, a.username, a.username.toLowerCase(), a.passwordHash, a.disabled ? 1 : 0, at, at],
      });
    },
    async update(a: AccountWrite, at: number): Promise<void> {
      await db.execute({
        sql: SQL.update,
        args: [a.username, a.username.toLowerCase(), a.passwordHash, a.disabled ? 1 : 0, at, a.id],
      });
    },
    /** Every access token issued before this stops working (the `ver` claim no longer matches). */
    revokeSessions: async (id: string): Promise<void> => {
      await db.execute({ sql: SQL.bumpVersion, args: [id] });
    },
    recordSignIn: async (id: string, at: number): Promise<void> => {
      await db.execute({ sql: SQL.signedIn, args: [at, id] });
    },
    /** Sets or replaces the account's security question and the hash of its normalised answer (docs/40 2.3). */
    setSecurityQuestion: async (id: string, question: number, answerHash: string, at: number): Promise<void> => {
      await db.execute({ sql: SQL.setQuestion, args: [question, answerHash, at, id] });
    },
    remove: async (id: string): Promise<boolean> =>
      (await db.execute({ sql: SQL.remove, args: [id] })).rowsAffected > 0,
  };
}

export type AccountRepository = ReturnType<typeof createAccountRepository>;
