import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { ProviderInputSchema, ProviderPatchSchema } from "../types/provider.js";
import { ok } from "./envelope.js";
import { actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

const ProviderParams = z.object({ providerId: z.string().regex(/^\d+$/) });

function providerIdFromParam(params: z.infer<typeof ProviderParams>): number {
  return Number(params.providerId);
}

/**
 * The providers (docs/03 section 7.2b), under `/api/admin`: nobody reads them without an admin token, so
 * every answer is `no-store`. A change needs a signed-in admin and is live as soon as it is saved.
 */
export function registerProviders(app: FastifyInstance, services: Services): void {
  app.get("/providers", async (_request, reply) => ok(reply, await services.providers.list()));

  app.get("/providers/:providerId", async (request, reply) => {
    const param = parseInput(ProviderParams, request.params);
    return ok(reply, await services.providers.get(providerIdFromParam(param)));
  });

  app.post("/providers", async (request, reply) => {
    const principal = await signedIn(services, request);
    const input = parseInput(ProviderInputSchema, request.body, ERRORS.providerInvalid);
    return ok(reply, await services.providers.create(input, actorOf(request, principal)), 201);
  });

  app.put("/providers/:providerId", async (request, reply) => {
    const principal = await signedIn(services, request);
    const param = parseInput(ProviderParams, request.params);
    const patch = parseInput(ProviderPatchSchema, request.body, ERRORS.providerInvalid);
    return ok(reply, await services.providers.update(providerIdFromParam(param), patch, actorOf(request, principal)));
  });

  app.delete("/providers/:providerId", async (request, reply) => {
    const principal = await signedIn(services, request);
    const param = parseInput(ProviderParams, request.params);
    return ok(reply, await services.providers.remove(providerIdFromParam(param), actorOf(request, principal)));
  });
}
