import type { FastifyInstance } from "fastify";

import { ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { UiStatePutSchema } from "../types/ui-state.js";
import { ok } from "./envelope.js";
import { signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

/**
 * The signed-in admin's own settings and shell layout (docs/29 section 12.2). Only the token's account is read or
 * written, and the answer is `no-store` like every `/api/admin` answer.
 */
export function registerAccountState(app: FastifyInstance, services: Services): void {
  app.get("/account-state", async (request, reply) => {
    const principal = await signedIn(services, request);
    return ok(reply, await services.uiState.read(principal));
  });

  app.put("/account-state", async (request, reply) => {
    const principal = await signedIn(services, request);
    const body = parseInput(UiStatePutSchema, request.body, ERRORS.accountStateInvalid);
    return ok(reply, await services.uiState.write(principal, body));
  });
}
