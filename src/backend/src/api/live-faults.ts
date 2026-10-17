import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.js";
import { FAULT_DURATION_MAX_MS } from "../constants/limits.js";
import { FAULTS } from "../live/engine/fault-state.js";
import type { Services } from "../services/service-registry.js";
import { ok } from "./envelope.js";
import { ANY_ADMIN, actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

const ChannelParams = z.object({ channelId: z.string().min(1).max(200) });
const millis = z.number().int().positive().max(FAULT_DURATION_MAX_MS);
const FaultInput = z.object({ fault: z.enum(FAULTS), durationMs: millis.optional(), delayMs: millis.optional() }).strict();

/**
 * Fault injection (docs/10 section 2, item 5; docs/26 section 3.3): set one fault on a live channel, or clear
 * it. A test tool, in memory only; an owner or editor may use it.
 */
export function registerLiveFaults(app: FastifyInstance, services: Services): void {
  app.put("/api/channels/:channelId/fault", async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const { channelId } = parseInput(ChannelParams, request.params);
    const { fault, durationMs, delayMs } = parseInput(FaultInput, request.body, ERRORS.faultInvalid);
    return ok(reply, services.channels.setFault(channelId, fault, durationMs, delayMs, actorOf(request, principal)));
  });

  app.delete("/api/channels/:channelId/fault", async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const { channelId } = parseInput(ChannelParams, request.params);
    return ok(reply, services.channels.clearFault(channelId, actorOf(request, principal)));
  });
}
