import type { FastifyReply, FastifyRequest } from "fastify";

import { REFRESH_TOKEN_TTL_MS } from "../constants/limits.js";

/**
 * One refresh-cookie transport (docs/03 section 7.12, docs/62 D4): the rotating refresh token rides in an
 * httpOnly cookie scoped to its program's auth routes, so a reload restores the session without any browser
 * storage. The access token is never in it. The console and the app each get an instance of their own; the
 * name is shared, the Path keeps them apart in the browser's jar.
 */
export interface RefreshCookieTransport {
  /** The refresh token a request carries in its cookie, or undefined. */
  of(request: FastifyRequest): string | undefined;
  /** Sets the cookie to this refresh token for its whole lifetime. */
  set(request: FastifyRequest, reply: FastifyReply, token: string): void;
  /** Removes the cookie (the session ended, or the cookie was no good). */
  clear(request: FastifyRequest, reply: FastifyReply): void;
  /** The header value that removes the cookie, for an answer that clears several scopes at once. */
  clearHeader(request: FastifyRequest): string;
}

export function createRefreshCookie(name: string, path: string): RefreshCookieTransport {
  const attributes = (request: FastifyRequest): string =>
    `Path=${path}; HttpOnly; SameSite=Strict${request.protocol === "https" ? "; Secure" : ""}`;

  const of = (request: FastifyRequest): string | undefined => {
    for (const part of (request.headers.cookie ?? "").split(";")) {
      const at = part.indexOf("=");
      if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim() || undefined;
    }
    return undefined;
  };

  const clearHeader = (request: FastifyRequest): string => `${name}=; Max-Age=0; ${attributes(request)}`;

  return {
    of,
    set: (request, reply, token) => {
      const maxAge = Math.floor(REFRESH_TOKEN_TTL_MS / 1000);
      void reply.header("set-cookie", `${name}=${token}; Max-Age=${maxAge}; ${attributes(request)}`);
    },
    clear: (request, reply) => {
      void reply.header("set-cookie", clearHeader(request));
    },
    clearHeader,
  };
}

/** The console's cookie, scoped to the admin auth routes (docs/03 section 7.12). */
export const adminRefreshCookie = createRefreshCookie("giga_refresh", "/api/admin/auth");

/** The app's second instance, scoped to the account auth routes (docs/62 section 3.2). */
export const accountRefreshCookie = createRefreshCookie("giga_refresh", "/api/account/auth");
