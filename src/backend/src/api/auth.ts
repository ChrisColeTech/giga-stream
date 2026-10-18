import type { FastifyInstance, FastifyRequest } from "fastify";

import { AppError, ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { LoginSchema, PasswordChangeSchema, RefreshSchema } from "../types/account.js";
import { ok } from "./envelope.js";
import { actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";
import { clearRefreshCookie, refreshCookieOf, setRefreshCookie } from "./refresh-cookie.js";

/** The refresh token a request presents: its body's, else its cookie's; none is `401 auth.refresh_invalid`. */
function tokenOf(request: FastifyRequest): string {
  const { refreshToken } = parseInput(RefreshSchema, request.body ?? {});
  const token = refreshToken ?? refreshCookieOf(request);
  if (token === undefined) throw new AppError(ERRORS.authRefreshInvalid);
  return token;
}

/** Sign-in and tokens (docs/03 section 7.12). */
export function registerAuth(app: FastifyInstance, services: Services): void {
  app.post("/api/auth/login", async (request, reply) => {
    const { username, password } = parseInput(LoginSchema, request.body);
    const session = await services.auth.login(username, password, actorOf(request));
    setRefreshCookie(request, reply, session.refreshToken);
    return ok(reply, session);
  });

  // The token comes from the body (API clients) or the httpOnly cookie (the admin app); the answer renews the cookie.
  app.post("/api/auth/refresh", async (request, reply) => {
    try {
      const session = services.auth.refresh(tokenOf(request));
      setRefreshCookie(request, reply, session.refreshToken);
      return ok(reply, session);
    } catch (error: unknown) {
      clearRefreshCookie(request, reply);
      throw error;
    }
  });

  app.post("/api/auth/logout", async (request, reply) => {
    clearRefreshCookie(request, reply);
    return ok(reply, services.auth.logout(tokenOf(request), actorOf(request)));
  });

  app.get("/api/auth/me", async (request, reply) => {
    const principal = signedIn(services, request);
    return ok(reply, services.auth.me(principal));
  });

  app.post("/api/auth/password", async (request, reply) => {
    const principal = signedIn(services, request);
    const { currentPassword, newPassword } = parseInput(PasswordChangeSchema, request.body);
    const changed = await services.auth.changePassword(principal, currentPassword, newPassword, actorOf(request, principal));
    clearRefreshCookie(request, reply); // every session of the account ended
    return ok(reply, changed);
  });
}
