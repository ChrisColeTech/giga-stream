import { refusalFor } from "@/lib/auth-errors";
import type { AuthPort } from "@/types/auth";
import { tokensOf } from "./schemas/session-schema";
import type { SessionApi } from "./session-api";

/** The sign-in seam (`34` section 5) over the request layer: `POST /api/auth/login` and `/logout`. It keeps no state; the
 *  store holds the tokens the answer carries. Never rejects. */
export function createAuthPort(api: Pick<SessionApi, "login" | "logout">): AuthPort {
  return {
    signIn: async (email, password) => {
      try {
        const session = await api.login(email, password);
        return {
          ok: true,
          session: { actor: { email: session.account.email, name: session.account.name }, tokens: tokensOf(session) },
        };
      } catch (error: unknown) {
        return { ok: false, refusal: refusalFor(error) };
      }
    },
    signOut: () => api.logout(),
  };
}
