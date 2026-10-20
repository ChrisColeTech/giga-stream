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
 * A signed-in admin (docs/03 sections 7.11-7.12): the one choke point every `/api/admin` route passes, and it
 * demands `kind='admin'` (docs/62 D3), so a user token is refused here with the usual 401 auth.unauthorized.
 * No or a bad token is the same refusal.
 */
export async function signedIn(services: Services, request: FastifyRequest): Promise<Principal> {
  return services.auth.authenticate(request.headers.authorization, "admin");
}

/**
 * A signed-in account of either kind (docs/62 section 3.3): the `/api/account` routes' guard. An admin may
 * use the app; a user never reaches the console, because that guard is `signedIn` above.
 */
export async function anySignedIn(services: Services, request: FastifyRequest): Promise<Principal> {
  return services.auth.authenticate(request.headers.authorization);
}

/**
 * Whether the request carries a valid admin token. It never refuses: a public read that asks for more
 * (`includeDisabled`) simply gets the public answer without one.
 */
export async function isAdmin(services: Services, request: FastifyRequest): Promise<boolean> {
  try {
    await signedIn(services, request);
    return true;
  } catch {
    return false;
  }
}
