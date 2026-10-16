import type { FastifyRequest } from "fastify";

import { AppError, ERRORS } from "../constants/errors.js";
import type { Actor } from "../services/audit-service.js";
import type { Services } from "../services/service-registry.js";
import type { Principal, Role } from "../types/account.js";

/** The address a request came from: the proxy's `X-Forwarded-For` only when `TRUST_PROXY` (Fastify's `ip`). */
export const actorOf = (request: FastifyRequest, principal?: Principal): Actor => ({
  address: request.ip,
  ...(principal && { principal }),
});

/**
 * A signed-in admin whose role is one of `roles` (docs/03 sections 7.11-7.12). No or a bad token is
 * `401 auth.unauthorized`; a role that may not do this is `403 auth.forbidden`.
 */
export function signedIn(services: Services, request: FastifyRequest, roles: readonly Role[]): Principal {
  const principal = services.auth.authenticate(request.headers.authorization);
  if (!roles.includes(principal.role)) throw new AppError(ERRORS.authForbidden);
  return principal;
}

export const ANY_ADMIN: readonly Role[] = ["owner", "editor"];
export const OWNER: readonly Role[] = ["owner"];
