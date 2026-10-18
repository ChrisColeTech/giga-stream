import { z } from "zod";
import type { SessionTokens } from "@/types/auth";
import { AccountSchema } from "./account-schema";

/* `POST /api/auth/login` and `/refresh` answer a Session (`29` section 5). Expiries are unix milliseconds. */
export const SessionSchema = z.object({
  accessToken: z.string().min(1),
  accessExpiresAt: z.number(),
  refreshToken: z.string().min(1),
  refreshExpiresAt: z.number(),
  account: AccountSchema,
});

export type BackendSession = z.infer<typeof SessionSchema>;

/** The session's tokens as the store holds them (in memory only). */
export const tokensOf = (session: BackendSession): SessionTokens => ({
  accessToken: session.accessToken,
  accessExpiresAt: session.accessExpiresAt,
  refreshToken: session.refreshToken,
  refreshExpiresAt: session.refreshExpiresAt,
});

/** `POST /api/auth/logout` answers an empty object, or nothing the app reads. */
export const AnySchema = z.unknown();
