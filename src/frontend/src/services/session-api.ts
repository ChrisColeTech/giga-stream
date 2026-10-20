import { api } from "./api";
import { ResetDoneSchema, ResetStartSchema } from "./schemas/reset-schema";
import {
  LogoutSchema,
  ProfileSchema,
  SessionSchema,
  type BackendSession,
} from "./schemas/session-schema";
import type { RegistrationInput } from "@/types/auth";
import type { z } from "zod";
import { useAppStore } from "@/store/app-store";

/* The app's auth transport (`62` sections 3.2 and 3.5), through the one request layer so every call keeps the
 * envelope handling and the events rows. The refresh token rides the httpOnly cookie scoped to `/api/account/auth`
 * (D4); the access token the answers carry lives in the store, in memory, and the request layer attaches it. The
 * reset reuses the console's sequence (`40`), which the backend mounts for both kinds at the public `/api/auth`
 * (`62` D2); the fileserver's proxy passes that prefix beside `/api/account`. */

export interface SessionApi {
  /** `POST /api/account/auth/login`: no token. Rejects; `lib/auth-errors` turns a refusal into a sentence. */
  login: (username: string, password: string) => Promise<BackendSession>;
  /** Registration answers the same session contract as login and sets the same refresh cookie. */
  register: (input: RegistrationInput & { readonly securityQuestion: number }) => Promise<BackendSession>;
  /** The authenticated profile patch answers the updated account row. */
  updateUsername: (username: string) => Promise<z.infer<typeof ProfileSchema>>;
  /** `POST /api/account/auth/restore`, the boot's cookie-only probe. Never rejects: a refused or absent cookie is
   *  null. One instance shares one probe, so a double boot sends one probe and the single-use refresh cookie's
   *  rotation is presented exactly once (a second presentation reads as a stolen token and ends every session). */
  restore: () => Promise<BackendSession | null>;
  /** `POST /api/account/auth/logout` with the refresh token the store still holds (the app cannot read the cookie).
   *  Never rejects: the session is gone whatever the answer is. */
  signOut: () => Promise<void>;
  /** `POST /api/auth/reset-start`. No token: the caller is signed out. Rejects. */
  resetStart: (username: string) => Promise<string>;
  /** `POST /api/auth/reset`. No token. A success ends the account's sessions everywhere. Rejects. */
  resetPassword: (username: string, answer: string, newPassword: string) => Promise<void>;
}

export function createSessionApi(): SessionApi {
  /* The boot's shared probe (see `restore`): made once per instance, answered once, whatever the answer is. */
  let probe: Promise<BackendSession | null> | null = null;
  return {
    login: (username, password) =>
      api("/api/account/auth/login", SessionSchema, {
        method: "POST",
        body: { username, password },
        area: "Connection",
      }),

    register: (input) =>
      api("/api/account/auth/register", SessionSchema, {
        method: "POST",
        body: input,
        area: "Connection",
      }),

    updateUsername: (username) =>
      api("/api/account/me", ProfileSchema, {
        method: "PATCH",
        body: { username },
        area: "Connection",
      }),

    restore: () => {
      probe ??= api("/api/account/auth/restore", SessionSchema, { method: "POST", area: "Connection" }).catch(
        () => null,
      );
      return probe;
    },

    signOut: async () => {
      const tokens = useAppStore.getState().tokens;
      if (tokens === null) return;
      try {
        await api("/api/account/auth/logout", LogoutSchema, {
          method: "POST",
          body: { refreshToken: tokens.refreshToken },
          area: "Connection",
        });
      } catch {
        /* A refused token, a transport failure: the session is gone either way (`62` section 3.5). */
      }
    },

    resetStart: async (username) => {
      const body = { username };
      return (await api("/api/auth/reset-start", ResetStartSchema, { method: "POST", body })).question;
    },

    resetPassword: async (username, answer, newPassword) => {
      const body = { username, answer, newPassword };
      await api("/api/auth/reset", ResetDoneSchema, { method: "POST", body });
    },
  };
}
