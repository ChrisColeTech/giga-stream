import { z } from "zod";

export const Username = z.string().trim().min(1).max(254);
export const Password = z.string().min(1).max(256);
export const SecurityAnswer = z.string().min(1).max(200);

export const LoginBody = z.object({ username: z.string().max(254), password: z.string().max(256) }).strict();
export const RegisterBody = z.object({
  username: Username,
  password: Password,
  securityQuestion: z.number().int().min(1).max(8),
  securityAnswer: SecurityAnswer,
}).strict();
export const RefreshBody = z.object({ refreshToken: z.string().min(1).max(200).optional() }).strict();
export const ProfilePatch = z.object({ username: Username }).strict();
export const ResetStartBody = z.object({ username: z.string().max(254) }).strict();
export const ResetBody = z.object({
  username: z.string().max(254), answer: z.string().max(200), newPassword: Password,
}).strict();
export const PasswordBody = z.object({ currentPassword: z.string().max(256), newPassword: Password }).strict();

export interface Account {
  id: string;
  username: string;
  kind: "admin" | "user";
  disabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastSignInAt?: number;
  securityQuestionSet: boolean;
}

export interface Principal {
  accountId: string;
  username: string;
  kind: "admin" | "user";
}

export interface Session {
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
  account: Account;
}
