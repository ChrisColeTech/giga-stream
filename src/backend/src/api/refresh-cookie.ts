import type { FastifyReply, FastifyRequest } from "fastify";

import { REFRESH_TOKEN_TTL_MS } from "../constants/limits.js";

/** The cookie that carries the rotating refresh token (docs/03 section 7.12): the admin app keeps no browser storage,
 *  so a reload restores the session through this httpOnly cookie. The access token is never in it. */
export const REFRESH_COOKIE = "giga_refresh";
const COOKIE_PATH = "/api/admin/auth";

const attributes = (request: FastifyRequest): string =>
  `Path=${COOKIE_PATH}; HttpOnly; SameSite=Strict${request.protocol === "https" ? "; Secure" : ""}`;

/** The refresh token a request carries in its cookie, or undefined. */
export function refreshCookieOf(request: FastifyRequest): string | undefined {
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at).trim() === REFRESH_COOKIE) return part.slice(at + 1).trim() || undefined;
  }
  return undefined;
}

/** Sets the cookie to this refresh token for its whole lifetime. */
export function setRefreshCookie(request: FastifyRequest, reply: FastifyReply, token: string): void {
  const maxAge = Math.floor(REFRESH_TOKEN_TTL_MS / 1000);
  void reply.header("set-cookie", `${REFRESH_COOKIE}=${token}; Max-Age=${maxAge}; ${attributes(request)}`);
}

/** Removes the cookie (the session ended, or the cookie was no good). */
export function clearRefreshCookie(request: FastifyRequest, reply: FastifyReply): void {
  void reply.header("set-cookie", `${REFRESH_COOKIE}=; Max-Age=0; ${attributes(request)}`);
}
