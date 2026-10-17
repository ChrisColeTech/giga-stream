import type { AuthPort, AuthResult } from "@/types/auth";
import { actorFor } from "./session";

/* The fixture auth port (`34` section 5). It answers at once, with no timer. Deleted by `29` (Wave 7), when
 * `services/auth.ts` posts to the backend.
 *
 *   ada@example.test / giga-demo   signs in            (the one demo pair; the email is not case sensitive)
 *   locked@example.test / anything is locked
 *   offline@example.test / anything cannot be reached
 *   any other pair                 is refused: the email or password is wrong */

export const DEMO_EMAIL = "ada@example.test";
export const DEMO_PASSWORD = "giga-demo";
export const LOCKED_EMAIL = "locked@example.test";
export const OFFLINE_EMAIL = "offline@example.test";

export function answerFor(email: string, password: string): AuthResult {
  const who = email.trim().toLowerCase();
  if (who === LOCKED_EMAIL) return { ok: false, refusal: "locked" };
  if (who === OFFLINE_EMAIL) return { ok: false, refusal: "unreachable" };
  if (who === DEMO_EMAIL && password === DEMO_PASSWORD) return { ok: true, session: { actor: actorFor(DEMO_EMAIL) } };
  return { ok: false, refusal: "invalid" };
}

export const fixtureAuthPort: AuthPort = {
  signIn: (email, password) => Promise.resolve(answerFor(email, password)),
  signOut: () => Promise.resolve(),
};
