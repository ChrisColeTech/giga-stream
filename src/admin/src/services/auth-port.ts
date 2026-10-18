import { refusalFor, resetRefusalFor } from "@/lib/auth-errors";
import type { AuthPort } from "@/types/auth";
import { tokensOf } from "./schemas/session-schema";
import type { SessionApi } from "./session-api";

/** The sign-in seam (`34` section 5) over the request layer: `POST /api/auth/login` and `/logout`, and the reset's
 *  `reset-start` and `reset` (`40`). It keeps no state; the store holds the tokens the answer carries. Never rejects. */
export function createAuthPort(api: Pick<SessionApi, "login" | "logout" | "resetStart" | "reset">): AuthPort {
  return {
    signIn: async (username, password) => {
      try {
        const session = await api.login(username, password);
        return {
          ok: true,
          session: {
            actor: {
              id: session.account.id,
              username: session.account.username,
              securityQuestionSet: session.account.securityQuestionSet === true,
            },
            tokens: tokensOf(session),
          },
        };
      } catch (error: unknown) {
        return { ok: false, refusal: refusalFor(error) };
      }
    },
    signOut: () => api.logout(),
    resetStart: async (username) => {
      try {
        return { ok: true, question: await api.resetStart(username) };
      } catch (error: unknown) {
        const refusal = resetRefusalFor(error);
        return { ok: false, refusal: refusal === "rate_limited" ? refusal : "unreachable" };
      }
    },
    resetPassword: async (username, answer, newPassword) => {
      try {
        await api.reset(username, answer, newPassword);
        return { ok: true };
      } catch (error: unknown) {
        return { ok: false, refusal: resetRefusalFor(error) };
      }
    },
  };
}
