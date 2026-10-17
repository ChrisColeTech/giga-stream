import type { FastifyInstance } from "fastify";

import { ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { UiStatePutSchema } from "../types/ui-state.js";
import { ok } from "./envelope.js";
import { signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

/**
 * The signed-in admin's own settings and shell layout (docs/29 section 12.2). Only the token's account is read or
 * written; the answers are `no-store` through the `/api/auth` prefix.
 */
export function registerAccountState(app: FastifyInstance, services: Services): void {
  app.get("/api/auth/me/state", async (request, reply) => {
    const principal = signedIn(services, request);
    return ok(reply, services.uiState.read(principal));
  });

  app.put("/api/auth/me/state", async (request, reply) => {
    const principal = signedIn(services, request);
    const body = parseInput(UiStatePutSchema, request.body, ERRORS.accountStateInvalid);
    return ok(reply, services.uiState.write(principal, body));
  });
}
