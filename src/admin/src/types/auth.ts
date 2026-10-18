/* The sign-in seam (`34` section 5). Components and the store speak these types; the fixture implements the port now and
 * `29` Wave 7 replaces it with `POST /api/auth/login` and `POST /api/auth/logout`. */

/** Who is signed in, as the Session section and the events sentences show them. */
export interface SessionActor {
  /** The account id as the backend gives it: a username can change, an id cannot, so own-account rules compare ids. */
  readonly id: string | number;
  readonly username: string;
  /** Whether the account has set its security question (`40`); read only, unknown (absent) until the backend says. */
  readonly securityQuestionSet?: boolean;
}

/** What a sign-in hands the store. Wave 7 widens it with the tokens of `29` section 5 (held in memory only). */
export interface AuthSession {
  readonly actor: SessionActor;
  readonly tokens: SessionTokens;
}

/** The session's tokens, held in memory only (never storage; the refresh token also rides an httpOnly cookie the app
 *  cannot read, and a reload restores the session from it): expiries are unix milliseconds. The refresh token is
 *  single-use, so a refresh replaces the whole object. */
export interface SessionTokens {
  readonly accessToken: string;
  readonly accessExpiresAt: number;
  readonly refreshToken: string;
  readonly refreshExpiresAt: number;
}

/** Why a sign-in was refused: `auth.invalid_credentials`, `backend.unreachable`. */
export type RefusalKind = "invalid" | "unreachable";

export type AuthResult =
  | { readonly ok: true; readonly session: AuthSession }
  | { readonly ok: false; readonly refusal: RefusalKind };

/** `POST /api/auth/reset-start`: the question to answer (the account's own, or a stand-in: the backend never says which),
 *  or why it could not be asked (`40` section 4.3). */
export type ResetStartResult =
  | { readonly ok: true; readonly question: string }
  | { readonly ok: false; readonly refusal: "unreachable" };

/** `POST /api/auth/reset`: `invalid` is `auth.reset_invalid` (a wrong answer, no account: one sentence for all),
 *  `weak` a `422` on the new password. */
export type ResetResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly refusal: "invalid" | "weak" | "unreachable" };

export interface AuthPort {
  /** Never rejects: every failure is a refusal. */
  signIn: (username: string, password: string) => Promise<AuthResult>;
  /** The on-load probe (one call, shared): the session the httpOnly refresh cookie restores, or null. Never rejects. */
  restore: () => Promise<AuthSession | null>;
  /** Never rejects: the session is cleared whatever the answer is (`29` section 6.1). */
  signOut: () => Promise<void>;
  /** Never rejects. No token is sent: the caller is signed out. */
  resetStart: (username: string) => Promise<ResetStartResult>;
  /** Never rejects. No token is sent. A success signs the account out everywhere, so the caller returns to the gate. */
  resetPassword: (username: string, answer: string, newPassword: string) => Promise<ResetResult>;
}
