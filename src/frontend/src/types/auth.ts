/* The sign-in seam's types (`62` sections 3.2 and 3.5), the app's side of the console's `types/auth.ts`: components,
 * hooks and the store speak these; `services/session-api.ts` speaks the wire. The session's actor and tokens live in
 * the one store, in memory, and nowhere else (D4). */

/** Who is signed in, as the Session section and the events sentences show them. */
export interface SessionActor {
  /** The account id as the backend gives it: a username can change, an id cannot. */
  readonly id: string;
  readonly username: string;
  /** What the account is for: the console (`admin`) or the app (`user`); an old answer without the kind is an admin. */
  readonly kind: "admin" | "user";
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

/** What a sign-in or a restore hands the store: the actor and the tokens, the access token among them. */
export interface AuthSession {
  readonly actor: SessionActor;
  readonly tokens: SessionTokens;
}

/** Why a sign-in was refused: a wrong pair, or an answer that never came (`62` section 3.5). */
export type RefusalKind = "invalid" | "unreachable";

export type AuthResult =
  | { readonly ok: true; readonly session: AuthSession }
  | { readonly ok: false; readonly refusal: RefusalKind };

/** `POST /api/admin/auth-security/reset-start`: the question to answer (the account's own, or a stand-in: the backend
 *  never says which), or why it could not be asked. */
export type ResetStartResult =
  | { readonly ok: true; readonly question: string }
  | { readonly ok: false; readonly refusal: "unreachable" };

/** `POST /api/admin/auth-security/reset`: `invalid` is `auth.reset_invalid` (a wrong answer, no account: one sentence
 *  for all), `weak` a `422` on the new password. */
export type ResetResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly refusal: "invalid" | "weak" | "unreachable" };
