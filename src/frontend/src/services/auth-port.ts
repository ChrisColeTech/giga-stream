import { refusalFor, resetRefusalFor } from "@/lib/auth-errors";
import type { AuthResult, AuthSession, ResetResult, ResetStartResult } from "@/types/auth";
import { actorOf, tokensOf, type BackendSession } from "./schemas/session-schema";
import { createSessionApi, type SessionApi } from "./session-api";

/** The sign-in seam (`62` section 3.5), the console's `services/auth-port.ts` for the app: the session transport plus
 *  the reset (`40`). It keeps no state - the store holds the actor and the tokens the answer carries - and never
 *  rejects: every failure is a refusal the gate can show. */
const sessionOf = (session: BackendSession): AuthSession => ({ actor: actorOf(session), tokens: tokensOf(session) });

export function createAuthPort(api: Pick<SessionApi, "login" | "signOut" | "resetStart" | "resetPassword" | "restore">) {
  return {
    signIn: async (username: string, password: string): Promise<AuthResult> => {
      try {
        return { ok: true, session: sessionOf(await api.login(username, password)) };
      } catch (error: unknown) {
        return { ok: false, refusal: refusalFor(error) };
      }
    },
    restore: async (): Promise<AuthSession | null> => {
      const session = await api.restore();
      return session === null ? null : sessionOf(session);
    },
    signOut: () => api.signOut(),
    resetStart: async (username: string): Promise<ResetStartResult> => {
      try {
        return { ok: true, question: await api.resetStart(username) };
      } catch {
        return { ok: false, refusal: "unreachable" };
      }
    },
    resetPassword: async (username: string, answer: string, newPassword: string): Promise<ResetResult> => {
      try {
        await api.resetPassword(username, answer, newPassword);
        return { ok: true };
      } catch (error: unknown) {
        return { ok: false, refusal: resetRefusalFor(error) };
      }
    },
  };
}

/** The app's one port: its instance owns the boot's shared restore probe. */
export const authPort = createAuthPort(createSessionApi());
