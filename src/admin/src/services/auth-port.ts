import { refusalFor, resetRefusalFor } from "@/lib/auth-errors";
import type { AuthPort, AuthSession } from "@/types/auth";
import { tokensOf, type BackendSession } from "./schemas/session-schema";
import type { SessionApi } from "./session-api";

/** The sign-in seam (`34` section 5) over the request layer: `POST /api/auth/login` and `/logout`, and the reset's
 *  `reset-start` and `reset` (`40`). It keeps no state; the store holds the tokens the answer carries. Never rejects. */
const sessionOf = (session: BackendSession): AuthSession => ({
  actor: {
    id: session.account.id,
    username: session.account.username,
    securityQuestionSet: session.account.securityQuestionSet === true,
  },
  tokens: tokensOf(session),
});

export function createAuthPort(api: Pick<SessionApi, "login" | "logout" | "resetStart" | "reset" | "restore">): AuthPort {
  return {
    signIn: async (username, password) => {
      try {
        return { ok: true, session: sessionOf(await api.login(username, password)) };
      } catch (error: unknown) {
        return { ok: false, refusal: refusalFor(error) };
      }
    },
    restore: async () => {
      const session = await api.restore();
      return session === null ? null : sessionOf(session);
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
