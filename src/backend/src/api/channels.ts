import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { ChannelInputSchema, ChannelPatchSchema } from "../types/channel.js";
import { ok } from "./envelope.js";
import { ANY_ADMIN, actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";

const ChannelParams = z.object({ channelId: z.string().min(1).max(200) });

/**
 * The channels (docs/03 section 7.2). Reads are public, so the fileserver can read them; a change needs a
 * signed-in admin and is live as soon as it is saved.
 */
export function registerChannels(app: FastifyInstance, services: Services): void {
  app.get("/api/channels", async (_request, reply) => ok(reply, services.channels.list()));

  app.get("/api/channels/:channelId", async (request, reply) => {
    const { channelId } = parseInput(ChannelParams, request.params);
    return ok(reply, services.channels.get(channelId));
  });

  app.post("/api/channels", async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const input = parseInput(ChannelInputSchema, request.body, ERRORS.channelInvalid);
    return ok(reply, services.channels.create(input, actorOf(request, principal)), 201);
  });

  app.patch("/api/channels/:channelId", async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const { channelId } = parseInput(ChannelParams, request.params);
    const patch = parseInput(ChannelPatchSchema, request.body, ERRORS.channelInvalid);
    return ok(reply, services.channels.update(channelId, patch, actorOf(request, principal)));
  });

  app.delete("/api/channels/:channelId", async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const { channelId } = parseInput(ChannelParams, request.params);
    return ok(reply, services.channels.remove(channelId, actorOf(request, principal)));
  });
}
