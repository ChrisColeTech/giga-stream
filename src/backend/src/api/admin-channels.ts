import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ERRORS } from "../constants/errors.js";
import { CHANNEL_BODY_LIMIT_BYTES } from "../constants/limits.js";
import type { Services } from "../services/service-registry.js";
import { ChannelBulkSchema } from "../types/channel-bulk.js";
import { ChannelInputSchema, ChannelPatchSchema } from "../types/channel-input.js";
import { AdminChannelQuerySchema } from "../types/channel-query.js";
import { ChannelStatusSchema } from "../types/channel-status.js";
import { ok } from "./envelope.js";
import { actorOf, signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";
import { baseOf } from "./request-base.js";

const ChannelParams = z.object({ channelId: z.string().min(1).max(200) });

/** A write may list up to 2,000 video paths, which the default body limit would refuse. */
const WRITE = { bodyLimit: CHANNEL_BODY_LIMIT_BYTES };

/**
 * The admin's channels (docs/26 section 3.3): both kinds, and for a live row its settings, source, state,
 * problem, renditions, playlist, now playing and fault. The full row carries local paths, so it needs an
 * signed-in admin and is never cached (`network-policy.ts`). A write is live as soon as it is saved; a live
 * write answers the row `preparing` while its engine rebuilds in the background. `limit` pages the list, with
 * search, filters and a sort (docs/41 section 3.1); without `limit` it is the whole list, as before. The
 * public read is `channels.ts`.
 */
export function registerAdminChannels(app: FastifyInstance, services: Services): void {
  app.get("/channels", async (request, reply) => {
    await signedIn(services, request);
    const query = parseInput(AdminChannelQuerySchema, request.query, ERRORS.requestInvalid);
    return ok(reply, await services.channels.listAdmin(baseOf(request), query.limit === undefined ? undefined : query));
  });

  /** One row, the same admin view (docs/36 section 8.2): signed in, `no-store`, `404 channel.not_found`. */
  app.get("/channels/:channelId", async (request, reply) => {
    await signedIn(services, request);
    const { channelId } = parseInput(ChannelParams, request.params);
    return ok(reply, await services.channels.getAdmin(channelId, baseOf(request)));
  });

  app.post("/channels", WRITE, async (request, reply) => {
    const principal = await signedIn(services, request);
    const input = parseInput(ChannelInputSchema, request.body, ERRORS.channelInvalid);
    return ok(reply, await services.channels.create(input, actorOf(request, principal), baseOf(request)), 201);
  });

  app.patch("/channels", WRITE, async (request, reply) => {
    const principal = await signedIn(services, request);
    const { enabled, ids } = parseInput(ChannelBulkSchema, request.body, ERRORS.channelInvalid);
    return ok(reply, await services.channels.setEnabledMany(ids, enabled, actorOf(request, principal)));
  });

  app.patch("/channels/:channelId", WRITE, async (request, reply) => {
    const principal = await signedIn(services, request);
    const { channelId } = parseInput(ChannelParams, request.params);
    const patch = parseInput(ChannelPatchSchema, request.body, ERRORS.channelInvalid);
    return ok(reply, await services.channels.update(channelId, patch, actorOf(request, principal), baseOf(request)));
  });

  app.delete("/channels/:channelId", async (request, reply) => {
    const principal = await signedIn(services, request);
    const { channelId } = parseInput(ChannelParams, request.params);
    return ok(reply, await services.channels.remove(channelId, actorOf(request, principal)));
  });

  app.put("/channels/:channelId/status", async (request, reply) => {
    const principal = await signedIn(services, request);
    const { channelId } = parseInput(ChannelParams, request.params);
    const { status } = parseInput(ChannelStatusSchema, request.body, ERRORS.channelInvalid);
    return ok(reply, await services.channels.setStatus(channelId, status, actorOf(request, principal), baseOf(request)));
  });

  app.post("/channels/:channelId/revert", async (request, reply) => {
    const principal = await signedIn(services, request);
    const { channelId } = parseInput(ChannelParams, request.params);
    return ok(reply, await services.channels.revert(channelId, actorOf(request, principal), baseOf(request)));
  });

  app.post("/channels/:channelId/rebuild", async (request, reply) => {
    const principal = await signedIn(services, request);
    const { channelId } = parseInput(ChannelParams, request.params);
    return ok(reply, await services.channels.rebuild(channelId, actorOf(request, principal), baseOf(request)));
  });
}
