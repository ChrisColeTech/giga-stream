import type { FastifyInstance, FastifyRequest } from "fastify";

import { AppError, ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { LoginSchema, RefreshSchema } from "../types/account.js";
import { ok } from "./envelope.js";
import { actorOf } from "./guard.js";
import { parseInput } from "./parse-input.js";
import { accountRefreshCookie } from "./refresh-cookie.js";

/** The refresh token a request presents: its body's, else its cookie's; none is `401 auth.refresh_invalid`. */
function tokenOf(request: FastifyRequest): string {
  const { refreshToken } = parseInput(RefreshSchema, request.body ?? {});
  const token = refreshToken ?? accountRefreshCookie.of(request);
  if (token === undefined) throw new AppError(ERRORS.authRefreshInvalid);
  return token;
}

/** The cookie-only token of the boot's restore: no body, just the cookie the last session left. */
function cookieToken(request: FastifyRequest): string {
  const token = accountRefreshCookie.of(request);
  if (token === undefined) throw new AppError(ERRORS.authRefreshInvalid);
  return token;
}

/**
 * The app's sign-in and tokens (docs/62 section 3.2): the console's routes with `services.auth` unchanged and
 * a second cookie instance scoped to `/api/account/auth` (docs/62 D4), plus `restore`, the cookie-only refresh
 * a page reload boots through. Any enabled account of either kind signs in here; the console's own routes
 * refuse a user's token at their guard (docs/62 D3). Mounted under `/api/account` (app.ts), so every answer
 * is `no-store`.
 */
export function registerAccountAuth(app: FastifyInstance, services: Services): void {
  app.post("/auth/login", async (request, reply) => {
    const { username, password } = parseInput(LoginSchema, request.body);
    const session = await services.auth.login(username, password, actorOf(request));
    accountRefreshCookie.set(request, reply, session.refreshToken);
    return ok(reply, session);
  });

  // The token comes from the body (API clients) or the httpOnly cookie; the answer renews the cookie.
  app.post("/auth/refresh", async (request, reply) => {
    try {
      const session = await services.auth.refresh(tokenOf(request));
      accountRefreshCookie.set(request, reply, session.refreshToken);
      return ok(reply, session);
    } catch (error: unknown) {
      accountRefreshCookie.clear(request, reply);
      throw error;
    }
  });

  // The reload's silent boot: the cookie alone, rotated like any refresh.
  app.post("/auth/restore", async (request, reply) => {
    try {
      const session = await services.auth.refresh(cookieToken(request));
      accountRefreshCookie.set(request, reply, session.refreshToken);
      return ok(reply, session);
    } catch (error: unknown) {
      accountRefreshCookie.clear(request, reply);
      throw error;
    }
  });

  app.post("/auth/logout", async (request, reply) => {
    accountRefreshCookie.clear(request, reply);
    return ok(reply, await services.auth.logout(tokenOf(request), actorOf(request)));
  });
}
