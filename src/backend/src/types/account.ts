import { z } from "zod";

import { ACCOUNT_NAME_MAX, PASSWORD_MAX, USERNAME_MAX, PASSWORD_MIN } from "../constants/limits.js";

/** An account as the backend answers it (docs/03 section 7.11). Never a hash. */
export interface AdminAccount {
  id: string;
  username: string;
  name: string;
  disabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastSignInAt?: number;
  /** Whether the account has set a security question (docs/40 section 3.2); read-only, never the question. */
  securityQuestionSet: boolean;
}

/** Who is making a request, as their access token and the account now say. */
export interface Principal {
  accountId: string;
  username: string;
}

/** The sign-in name: any text, trimmed, 1 to 254 characters; no format is checked (owner, 2026-10-17). */
const username = z.string().trim().min(1).max(USERNAME_MAX);
const password = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);
const name = z.string().trim().min(1).max(ACCOUNT_NAME_MAX);

export const AccountCreateSchema = z.object({ username, name, password }).strict();
export type AccountCreate = z.infer<typeof AccountCreateSchema>;

export const AccountPatchSchema = z
  .object({ username, name, password, disabled: z.boolean() })
  .partial()
  .strict();
export type AccountPatch = z.infer<typeof AccountPatchSchema>;

export const LoginSchema = z
  .object({ username: z.string().max(USERNAME_MAX), password: z.string().max(PASSWORD_MAX) })
  .strict();
export const RefreshSchema = z.object({ refreshToken: z.string().min(1).max(200) }).strict();
export const PasswordChangeSchema = z.object({ currentPassword: z.string().max(PASSWORD_MAX), newPassword: password }).strict();

/** What sign-in and refresh answer (section 7.12). */
export interface Session {
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
  account: AdminAccount;
}
