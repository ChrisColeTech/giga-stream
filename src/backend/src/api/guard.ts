import type { FastifyRequest } from "fastify";

import type { Actor } from "../services/audit-service.js";
import type { Services } from "../services/service-registry.js";
import type { Principal } from "../types/account.js";

/** The address a request came from: the proxy's `X-Forwarded-For` only when `TRUST_PROXY` (Fastify's `ip`). */
export const actorOf = (request: FastifyRequest, principal?: Principal): Actor => ({
  address: request.ip,
  ...(principal && { principal }),
});

/**
 * A signed-in admin (docs/03 sections 7.11-7.12); every admin account is equal (docs/26 D22). No or a bad
 * token is `401 auth.unauthorized`.
 */
export function signedIn(services: Services, request: FastifyRequest): Principal {
  return services.auth.authenticate(request.headers.authorization);
}

/**
 * Whether the request carries a valid admin token. It never refuses: a public read that asks for more
 * (`includeDisabled`) simply gets the public answer without one.
 */
export function isAdmin(services: Services, request: FastifyRequest): boolean {
  try {
    signedIn(services, request);
    return true;
  } catch {
    return false;
  }
}
