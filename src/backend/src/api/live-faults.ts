import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.js";
import { FAULT_DURATION_MAX_MS } from "../constants/limits.js";
import { FAULTS } from "../live/engine/fault-state.js";
import type { Services } from "../services/service-registry.js";
import { ok } from "./envelope.js";
import { actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

const ChannelParams = z.object({ channelId: z.string().min(1).max(200) });
const millis = z.number().int().positive().max(FAULT_DURATION_MAX_MS);
const FaultInput = z.object({ fault: z.enum(FAULTS), durationMs: millis.optional(), delayMs: millis.optional() }).strict();

/**
 * Fault injection (docs/10 section 2, item 5; docs/26 section 3.3): set one fault on a live channel, or clear
 * it. A test tool, in memory only; any signed-in admin may use it. The fault routes sit in their own
 * `/api/admin/live-faults/...` namespace, beside the channel writes of `admin-channels.ts`.
 */
export function registerLiveFaults(app: FastifyInstance, services: Services): void {
  app.put("/live-faults/:channelId/fault", async (request, reply) => {
    const principal = await signedIn(services, request);
    const { channelId } = parseInput(ChannelParams, request.params);
    const { fault, durationMs, delayMs } = parseInput(FaultInput, request.body, ERRORS.faultInvalid);
    return ok(reply, await services.channels.setFault(channelId, fault, durationMs, delayMs, actorOf(request, principal)));
  });

  app.delete("/live-faults/:channelId/fault", async (request, reply) => {
    const principal = await signedIn(services, request);
    const { channelId } = parseInput(ChannelParams, request.params);
    return ok(reply, await services.channels.clearFault(channelId, actorOf(request, principal)));
  });
}
