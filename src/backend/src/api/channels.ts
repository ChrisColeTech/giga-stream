import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.js";
import { CHANNEL_BODY_LIMIT_BYTES } from "../constants/limits.js";
import type { Services } from "../services/service-registry.js";
import { ChannelInputSchema, ChannelPatchSchema } from "../types/channel-input.js";
import { ok } from "./envelope.js";
import { ANY_ADMIN, actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";
import { baseOf } from "./request-base.js";

const ChannelParams = z.object({ channelId: z.string().min(1).max(200) });

/** A write may list up to 2,000 video paths, which the default body limit would refuse. */
const WRITE = { bodyLimit: CHANNEL_BODY_LIMIT_BYTES };

/**
 * The channels of both kinds (docs/03 section 7.2, docs/26 section 3.3). Reads are public, so the fileserver
 * can read them; a change needs a signed-in admin and is live as soon as it is saved. A live write answers
 * the admin view of the row, `preparing` while its engine rebuilds in the background.
 */
export function registerChannels(app: FastifyInstance, services: Services): void {
  app.get("/api/channels", async (request, reply) => ok(reply, services.channels.list(baseOf(request))));

  app.get("/api/channels/:channelId", async (request, reply) => {
    const { channelId } = parseInput(ChannelParams, request.params);
    return ok(reply, services.channels.get(channelId, baseOf(request)));
  });

  app.post("/api/channels", WRITE, async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const input = parseInput(ChannelInputSchema, request.body, ERRORS.channelInvalid);
    return ok(reply, services.channels.create(input, actorOf(request, principal), baseOf(request)), 201);
  });

  app.patch("/api/channels/:channelId", WRITE, async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const { channelId } = parseInput(ChannelParams, request.params);
    const patch = parseInput(ChannelPatchSchema, request.body, ERRORS.channelInvalid);
    return ok(reply, await services.channels.update(channelId, patch, actorOf(request, principal), baseOf(request)));
  });

  app.delete("/api/channels/:channelId", async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const { channelId } = parseInput(ChannelParams, request.params);
    return ok(reply, await services.channels.remove(channelId, actorOf(request, principal)));
  });

  app.post("/api/channels/:channelId/revert", async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const { channelId } = parseInput(ChannelParams, request.params);
    return ok(reply, services.channels.revert(channelId, actorOf(request, principal), baseOf(request)));
  });

  app.post("/api/channels/:channelId/rebuild", async (request, reply) => {
    const principal = signedIn(services, request, ANY_ADMIN);
    const { channelId } = parseInput(ChannelParams, request.params);
    return ok(reply, services.channels.rebuild(channelId, actorOf(request, principal), baseOf(request)));
  });
}
