import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.ts";
import { FAULT_DURATION_MAX_MS } from "../constants/limits.ts";
import { FAULTS } from "../services/fault-state.ts";
import type { Services } from "../services/service-registry.ts";
import { ok } from "./envelope.ts";
import { fromThisComputer } from "./guard.ts";
import { parseInput } from "./parse-input.ts";

const ChannelParams = z.object({ channelId: z.string().min(1).max(200) });
const millis = z.number().int().positive().max(FAULT_DURATION_MAX_MS);
const FaultInput = z.object({ fault: z.enum(FAULTS), durationMs: millis.optional(), delayMs: millis.optional() }).strict();

/** Fault injection (docs/10 section 2, item 5): set one fault on a channel, or clear it. This computer only. */
export function registerFaults(app: FastifyInstance, services: Services): void {
  app.put("/api/channels/:channelId/fault", async (request, reply) => {
    fromThisComputer(request);
    const { channelId } = parseInput(ChannelParams, request.params);
    const { fault, durationMs, delayMs } = parseInput(FaultInput, request.body, ERRORS.faultInvalid);
    return ok(reply, services.faults.set(channelId, fault, durationMs, delayMs));
  });

  app.delete("/api/channels/:channelId/fault", async (request, reply) => {
    fromThisComputer(request);
    const { channelId } = parseInput(ChannelParams, request.params);
    return ok(reply, services.faults.clear(channelId));
  });
}
