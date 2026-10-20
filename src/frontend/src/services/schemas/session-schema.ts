import { z } from "zod";
import type { SessionActor, SessionTokens } from "@/types/auth";

/** `POST /api/account/auth/login` and `/refresh` and `/restore` answer a Session (`62` section 3.2): the console's
 *  shape, non-strict on the account the way the console reads it - a field the backend adds later is ignored, and an
 *  absent `kind` means admin (`62` section 3.7). Expiries are unix milliseconds. */
export const AccountSchema = z.object({
  id: z.string(),
  username: z.string(),
  kind: z.enum(["admin", "user"]).optional(),
  disabled: z.boolean().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
  lastSignInAt: z.number().optional(),
  securityQuestionSet: z.boolean().optional(),
});

export const ProfileSchema = z.object({
  id: z.string(),
  username: z.string(),
  kind: z.enum(["admin", "user"]),
  disabled: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastSignInAt: z.number().optional(),
  securityQuestionSet: z.boolean(),
});

export const SessionSchema = z.object({
  accessToken: z.string().min(1),
  accessExpiresAt: z.number(),
  refreshToken: z.string().min(1),
  refreshExpiresAt: z.number(),
  account: AccountSchema,
});

export type BackendSession = z.infer<typeof SessionSchema>;

/** The account of an answer, as the store holds it: an absent kind is an admin, never an unknown. */
export const actorOf = (session: BackendSession): SessionActor => ({
  id: session.account.id,
  username: session.account.username,
  kind: session.account.kind ?? "admin",
});

export const actorOfAccount = (account: z.infer<typeof AccountSchema>): SessionActor => ({
  id: account.id,
  username: account.username,
  kind: account.kind ?? "admin",
});

/** The session's tokens as the store holds them (in memory only). */
export const tokensOf = (session: BackendSession): SessionTokens => ({
  accessToken: session.accessToken,
  accessExpiresAt: session.accessExpiresAt,
  refreshToken: session.refreshToken,
  refreshExpiresAt: session.refreshExpiresAt,
});

/** `POST /api/account/auth/logout` answers the ended refresh token's confirmation. */
export const LogoutSchema = z.object({ signedOut: z.literal(true) });
