import { profileRefusalFor, refusalFor, registrationRefusalFor, resetRefusalFor } from "@/lib/auth-errors";
import type {
  AuthResult,
  AuthSession,
  ProfileResult,
  RegistrationInput,
  RegistrationResult,
  ResetResult,
  ResetStartResult,
} from "@/types/auth";
import { actorOf, actorOfAccount, tokensOf, type BackendSession } from "./schemas/session-schema";
import { createSessionApi, type SessionApi } from "./session-api";

/** The sign-in seam (`62` section 3.5), the console's `services/auth-port.ts` for the app: the session transport plus
 *  the reset (`40`). It keeps no state - the store holds the actor and the tokens the answer carries - and never
 *  rejects: every failure is a refusal the gate can show. */
const sessionOf = (session: BackendSession): AuthSession => ({ actor: actorOf(session), tokens: tokensOf(session) });

type AuthApi = Pick<
  SessionApi,
  "login" | "register" | "updateUsername" | "signOut" | "resetStart" | "resetPassword" | "restore"
>;

export function createAuthPort(api: AuthApi) {
  return {
    signIn: async (username: string, password: string): Promise<AuthResult> => {
      try {
        return { ok: true, session: sessionOf(await api.login(username, password)) };
      } catch (error: unknown) {
        return { ok: false, refusal: refusalFor(error) };
      }
    },
    register: async (input: RegistrationInput & { readonly securityQuestion: number }): Promise<RegistrationResult> => {
      try {
        return { ok: true, session: sessionOf(await api.register(input)) };
      } catch (error: unknown) {
        return { ok: false, refusal: registrationRefusalFor(error) };
      }
    },
    updateUsername: async (username: string): Promise<ProfileResult> => {
      try {
        return { ok: true, actor: actorOfAccount(await api.updateUsername(username)) };
      } catch (error: unknown) {
        return { ok: false, refusal: profileRefusalFor(error) };
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
