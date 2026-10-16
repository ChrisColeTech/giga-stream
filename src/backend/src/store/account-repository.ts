import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

import type { AdminAccount, Role } from "../types/account.js";

const AccountRow = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(["owner", "editor"]),
  password_hash: z.string(),
  disabled: z.number().int(),
  session_version: z.number().int(),
  failed_sign_ins: z.number().int(),
  locked_until: z.number().int().nullable(),
  created_at: z.number().int(),
  updated_at: z.number().int(),
  last_sign_in_at: z.number().int().nullable(),
});

/** A stored account, including what never leaves the backend (the hash and the sign-in counters). */
export interface StoredAccount {
  account: AdminAccount;
  passwordHash: string;
  sessionVersion: number;
  failedSignIns: number;
  lockedUntil: number | null;
}

function toStored(row: unknown): StoredAccount {
  const r = AccountRow.parse(row);
  return {
    account: {
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      disabled: r.disabled === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      ...(r.last_sign_in_at !== null && { lastSignInAt: r.last_sign_in_at }),
    },
    passwordHash: r.password_hash,
    sessionVersion: r.session_version,
    failedSignIns: r.failed_sign_ins,
    lockedUntil: r.locked_until,
  };
}

export interface AccountWrite {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
  disabled: boolean;
}

const COLUMNS = `id, email, name, role, password_hash, disabled, session_version, failed_sign_ins, locked_until,
  created_at, updated_at, last_sign_in_at`;

/** The admin accounts table (docs/03 section 7.11). Emails are unique without case. */
export function createAccountRepository(db: DatabaseSync) {
  const byId = db.prepare(`SELECT ${COLUMNS} FROM admin_accounts WHERE id = ?`);
  const byEmail = db.prepare(`SELECT ${COLUMNS} FROM admin_accounts WHERE email_key = ?`);
  const all = db.prepare(`SELECT ${COLUMNS} FROM admin_accounts ORDER BY email_key`);
  const count = db.prepare("SELECT COUNT(*) AS n FROM admin_accounts");
  const owners = db.prepare("SELECT COUNT(*) AS n FROM admin_accounts WHERE role = 'owner' AND disabled = 0");
  const insert = db.prepare(`INSERT INTO admin_accounts (id, email, email_key, name, role, password_hash, disabled,
    created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const update = db.prepare(`UPDATE admin_accounts SET email = ?, email_key = ?, name = ?, role = ?, password_hash = ?,
    disabled = ?, updated_at = ? WHERE id = ?`);
  const bumpVersion = db.prepare("UPDATE admin_accounts SET session_version = session_version + 1 WHERE id = ?");
  const signInFailed = db.prepare("UPDATE admin_accounts SET failed_sign_ins = ?, locked_until = ? WHERE id = ?");
  const signedIn = db.prepare(
    "UPDATE admin_accounts SET failed_sign_ins = 0, locked_until = NULL, last_sign_in_at = ? WHERE id = ?",
  );
  const remove = db.prepare("DELETE FROM admin_accounts WHERE id = ?");
  const n = (statement: { get: () => unknown }): number => z.object({ n: z.number() }).parse(statement.get()).n;

  return {
    find(id: string): StoredAccount | undefined {
      const row = byId.get(id);
      return row === undefined ? undefined : toStored(row);
    },
    findByEmail(email: string): StoredAccount | undefined {
      const row = byEmail.get(email.toLowerCase());
      return row === undefined ? undefined : toStored(row);
    },
    list: (): StoredAccount[] => all.all().map(toStored),
    count: (): number => n(count),
    enabledOwners: (): number => n(owners),
    insert(a: AccountWrite, at: number): void {
      insert.run(a.id, a.email, a.email.toLowerCase(), a.name, a.role, a.passwordHash, a.disabled ? 1 : 0, at, at);
    },
    update(a: AccountWrite, at: number): void {
      update.run(a.email, a.email.toLowerCase(), a.name, a.role, a.passwordHash, a.disabled ? 1 : 0, at, a.id);
    },
    /** Every access token issued before this stops working (the `ver` claim no longer matches). */
    revokeSessions: (id: string): void => void bumpVersion.run(id),
    recordFailure: (id: string, failures: number, lockedUntil: number | null): void =>
      void signInFailed.run(failures, lockedUntil, id),
    recordSignIn: (id: string, at: number): void => void signedIn.run(at, id),
    remove: (id: string): boolean => Number(remove.run(id).changes) > 0,
  };
}

export type AccountRepository = ReturnType<typeof createAccountRepository>;
