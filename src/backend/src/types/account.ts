import { z } from "zod";

import { ACCOUNT_NAME_MAX, EMAIL_MAX, PASSWORD_MAX, PASSWORD_MIN } from "../constants/limits.js";

/** An account as the backend answers it (docs/03 section 7.11). Never a hash. */
export interface AdminAccount {
  id: string;
  email: string;
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
  email: string;
}

const email = z.string().trim().min(3).max(EMAIL_MAX).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
const password = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);
const name = z.string().trim().min(1).max(ACCOUNT_NAME_MAX);

export const AccountCreateSchema = z.object({ email, name, password }).strict();
export type AccountCreate = z.infer<typeof AccountCreateSchema>;

export const AccountPatchSchema = z
  .object({ email, name, password, disabled: z.boolean() })
  .partial()
  .strict();
export type AccountPatch = z.infer<typeof AccountPatchSchema>;

export const LoginSchema = z.object({ email: z.string().max(EMAIL_MAX), password: z.string().max(PASSWORD_MAX) }).strict();
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
