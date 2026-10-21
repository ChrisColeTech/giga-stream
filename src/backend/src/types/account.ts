import { z } from "zod";

import { PASSWORD_MAX, USERNAME_MAX, PASSWORD_MIN } from "../constants/limits.js";

/** The two kinds of account (docs/62 decision D1): the console's admins and the app's users. */
export type AccountKind = "admin" | "user";

/** An account as the backend answers it (docs/03 section 7.11, docs/62 section 3.7). Never a hash. */
export interface AdminAccount {
  id: string;
  username: string;
  kind: AccountKind;
  disabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastSignInAt?: number;
  /** Whether the account has set a security question (docs/40 section 3.2); read-only, never the question. */
  securityQuestionSet: boolean;
}

/** Who is making a request, as their access token and the account now say; the kind tells the console's
 *  actors from the app's in the audit log (docs/62 section 3.2). */
export interface Principal {
  accountId: string;
  username: string;
  kind: AccountKind;
}

/** The sign-in name: any text, trimmed, 1 to 254 characters; no format is checked (owner, 2026-10-17). */
const username = z.string().trim().min(1).max(USERNAME_MAX);
const password = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);

/** `kind` is a create-time choice that defaults to the console's admin; it is never patchable (docs/62 section 3.7). */
export const AccountCreateSchema = z
  .object({ username, password, kind: z.enum(["admin", "user"]).default("admin") })
  .strict();
export type AccountCreate = z.infer<typeof AccountCreateSchema>;

export const AccountPatchSchema = z
  .object({ username, password, disabled: z.boolean() })
  .partial()
  .strict();
export type AccountPatch = z.infer<typeof AccountPatchSchema>;

export const LoginSchema = z
  .object({ username: z.string().max(USERNAME_MAX), password: z.string().max(PASSWORD_MAX) })
  .strict();
/** The refresh token may be omitted: the cookie carries it (docs/03 section 7.12). */
export const RefreshSchema = z.object({ refreshToken: z.string().min(1).max(200).optional() }).strict();
export const PasswordChangeSchema = z.object({ currentPassword: z.string().max(PASSWORD_MAX), newPassword: password }).strict();

/** What sign-in and refresh answer (section 7.12). */
export interface Session {
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
  account: AdminAccount;
}
