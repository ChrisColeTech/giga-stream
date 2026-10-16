import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.ts";
import type { Services } from "../services/service-registry.ts";
import { ChannelInputSchema, ChannelPatchSchema } from "../types/channel.ts";
import { ok } from "./envelope.ts";
import { baseOf, fromThisComputer } from "./guard.ts";
import { parseInput } from "./parse-input.ts";

const ChannelParams = z.object({ channelId: z.string().min(1).max(200) });

/**
 * The channels (docs/10 section 3.1). Reads are open; a change is accepted from this computer only and is
 * live at once: the answer says `preparing` while the channel's videos are read and encoded.
 */
export function registerChannels(app: FastifyInstance, services: Services): void {
  app.get("/api/channels", async (request, reply) => ok(reply, services.channels.list(baseOf(request))));

  app.get("/api/channels/:channelId", async (request, reply) => {
    const { channelId } = parseInput(ChannelParams, request.params);
    return ok(reply, services.channels.get(channelId, baseOf(request)));
  });

  app.post("/api/channels", async (request, reply) => {
    fromThisComputer(request);
    const input = parseInput(ChannelInputSchema, request.body, ERRORS.channelInvalid);
    return ok(reply, services.channels.create(input, baseOf(request)), 201);
  });

  app.patch("/api/channels/:channelId", async (request, reply) => {
    fromThisComputer(request);
    const { channelId } = parseInput(ChannelParams, request.params);
    const patch = parseInput(ChannelPatchSchema, request.body, ERRORS.channelInvalid);
    return ok(reply, services.channels.update(channelId, patch, baseOf(request)));
  });

  app.delete("/api/channels/:channelId", async (request, reply) => {
    fromThisComputer(request);
    const { channelId } = parseInput(ChannelParams, request.params);
    return ok(reply, await services.channels.remove(channelId));
  });
}
