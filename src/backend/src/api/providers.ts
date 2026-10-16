import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { ProviderInputSchema, ProviderPatchSchema } from "../types/provider.js";
import { ok } from "./envelope.js";
import { ANY_ADMIN, actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

const ProviderParams = z.object({ providerId: z.string().regex(/^\d+$/) });

function providerIdFromParam(params: z.infer<typeof ProviderParams>): number {
  return Number(params.providerId);
}

/**
 * The providers (docs/03 section 7.2b). Reads are public, so the fileserver can read them; a change needs a
 * signed-in admin and is live as soon as it is saved.
 */
export function registerProviders(app: FastifyInstance, services: Services): void {
  app.get("/api/providers", async (_request, reply) => ok(reply, services.providers.list()));

  app.get("/api/providers/:providerId", async (request, reply) => {
    const param = parseInput(ProviderParams, request.params);
    return ok(reply, services.providers.get(providerIdFromParam(param)));
  });

  app.post("/api/providers", async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const input = parseInput(ProviderInputSchema, request.body, ERRORS.providerInvalid);
    return ok(reply, services.providers.create(input, actorOf(request, principal)), 201);
  });

  app.put("/api/providers/:providerId", async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const param = parseInput(ProviderParams, request.params);
    const patch = parseInput(ProviderPatchSchema, request.body, ERRORS.providerInvalid);
    return ok(reply, services.providers.update(providerIdFromParam(param), patch, actorOf(request, principal)));
  });

  app.delete("/api/providers/:providerId", async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const param = parseInput(ProviderParams, request.params);
    return ok(reply, services.providers.remove(providerIdFromParam(param), actorOf(request, principal)));
  });
}
