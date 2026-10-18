import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

import type { AdminAccount } from "../types/account.js";

const AccountRow = z.object({
  id: z.string(),
  username: z.string(),
  password_hash: z.string(),
  disabled: z.number().int(),
  session_version: z.number().int(),
  failed_sign_ins: z.number().int(),
  locked_until: z.number().int().nullable(),
  created_at: z.number().int(),
  updated_at: z.number().int(),
  last_sign_in_at: z.number().int().nullable(),
  security_question: z.number().int().nullable(),
  security_answer_hash: z.string().nullable(),
});

/** A stored account, including what never leaves the backend (the hashes and the sign-in counters). */
export interface StoredAccount {
  account: AdminAccount;
  passwordHash: string;
  sessionVersion: number;
  failedSignIns: number;
  lockedUntil: number | null;
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
    failedSignIns: r.failed_sign_ins,
    lockedUntil: r.locked_until,
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

const COLUMNS = `id, username, password_hash, disabled, session_version, failed_sign_ins, locked_until,
  created_at, updated_at, last_sign_in_at, security_question, security_answer_hash`;

/** The admin accounts table (docs/03 section 7.11). Usernames are unique without case. */
export function createAccountRepository(db: DatabaseSync) {
  const byId = db.prepare(`SELECT ${COLUMNS} FROM admin_accounts WHERE id = ?`);
  const byUsername = db.prepare(`SELECT ${COLUMNS} FROM admin_accounts WHERE username_key = ?`);
  const all = db.prepare(`SELECT ${COLUMNS} FROM admin_accounts ORDER BY username_key`);
  const count = db.prepare("SELECT COUNT(*) AS n FROM admin_accounts");
  const enabled = db.prepare("SELECT COUNT(*) AS n FROM admin_accounts WHERE disabled = 0");
  const insert = db.prepare(`INSERT INTO admin_accounts (id, username, username_key, password_hash, disabled,
    created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const update = db.prepare(`UPDATE admin_accounts SET username = ?, username_key = ?, password_hash = ?,
    disabled = ?, updated_at = ? WHERE id = ?`);
  const bumpVersion = db.prepare("UPDATE admin_accounts SET session_version = session_version + 1 WHERE id = ?");
  const signInFailed = db.prepare("UPDATE admin_accounts SET failed_sign_ins = ?, locked_until = ? WHERE id = ?");
  const signedIn = db.prepare(
    "UPDATE admin_accounts SET failed_sign_ins = 0, locked_until = NULL, last_sign_in_at = ? WHERE id = ?",
  );
  const setQuestion = db.prepare(
    "UPDATE admin_accounts SET security_question = ?, security_answer_hash = ?, updated_at = ? WHERE id = ?",
  );
  const clearLockout = db.prepare("UPDATE admin_accounts SET failed_sign_ins = 0, locked_until = NULL WHERE id = ?");
  const remove = db.prepare("DELETE FROM admin_accounts WHERE id = ?");
  const n = (statement: { get: () => unknown }): number => z.object({ n: z.number() }).parse(statement.get()).n;

  return {
    find(id: string): StoredAccount | undefined {
      const row = byId.get(id);
      return row === undefined ? undefined : toStored(row);
    },
    findByUsername(username: string): StoredAccount | undefined {
      const row = byUsername.get(username.toLowerCase());
      return row === undefined ? undefined : toStored(row);
    },
    list: (): StoredAccount[] => all.all().map(toStored),
    count: (): number => n(count),
    enabledCount: (): number => n(enabled),
    insert(a: AccountWrite, at: number): void {
      insert.run(a.id, a.username, a.username.toLowerCase(), a.passwordHash, a.disabled ? 1 : 0, at, at);
    },
    update(a: AccountWrite, at: number): void {
      update.run(a.username, a.username.toLowerCase(), a.passwordHash, a.disabled ? 1 : 0, at, a.id);
    },
    /** Every access token issued before this stops working (the `ver` claim no longer matches). */
    revokeSessions: (id: string): void => void bumpVersion.run(id),
    recordFailure: (id: string, failures: number, lockedUntil: number | null): void =>
      void signInFailed.run(failures, lockedUntil, id),
    recordSignIn: (id: string, at: number): void => void signedIn.run(at, id),
    /** Sets or replaces the account's security question and the hash of its normalised answer (docs/40 2.3). */
    setSecurityQuestion: (id: string, question: number, answerHash: string, at: number): void =>
      void setQuestion.run(question, answerHash, at, id),
    /** Clears the sign-in lockout (the failed count and the lock); a reset does this (docs/40 2.4 step 6). */
    clearAttempts: (id: string): void => void clearLockout.run(id),
    remove: (id: string): boolean => Number(remove.run(id).changes) > 0,
  };
}

export type AccountRepository = ReturnType<typeof createAccountRepository>;
