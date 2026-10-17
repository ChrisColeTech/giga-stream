/* The sign-in seam (`34` section 5). Components and the store speak these types; the fixture implements the port now and
 * `29` Wave 7 replaces it with `POST /api/auth/login` and `POST /api/auth/logout`. */

/** Who is signed in, as the Session section and the events sentences show them. */
export interface SessionActor {
  readonly email: string;
  readonly name: string;
}

/** What a sign-in hands the store. Wave 7 widens it with the tokens of `29` section 5 (held in memory only). */
export interface AuthSession {
  readonly actor: SessionActor;
}

/** Why a sign-in was refused: `auth.invalid_credentials`, `auth.locked`, `auth.rate_limited`, `backend.unreachable`. */
export type RefusalKind = "invalid" | "locked" | "rate_limited" | "unreachable";

export type AuthResult =
  | { readonly ok: true; readonly session: AuthSession }
  | { readonly ok: false; readonly refusal: RefusalKind };

export interface AuthPort {
  /** Never rejects: every failure is a refusal. */
  signIn: (email: string, password: string) => Promise<AuthResult>;
  /** Never rejects: the session is cleared whatever the answer is (`29` section 6.1). */
  signOut: () => Promise<void>;
}
