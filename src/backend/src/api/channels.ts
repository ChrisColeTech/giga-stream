import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { Services } from "../services/service-registry.js";
import { ok } from "./envelope.js";
import { parseInput } from "./parse-input.js";
import { baseOf } from "./request-base.js";

const ChannelParams = z.object({ channelId: z.string().min(1).max(200) });

/**
 * The public channel reads (docs/03 section 7.2): tokenless, so the fileserver can read them. A change needs
 * a signed-in admin and lives under `/api/admin/channels` (`admin-channels.ts`), live as soon as it is saved.
 */
export function registerChannels(app: FastifyInstance, services: Services): void {
  app.get("/api/channels", async (request, reply) => ok(reply, await services.channels.list(baseOf(request))));

  app.get("/api/channels/:channelId", async (request, reply) => {
    const { channelId } = parseInput(ChannelParams, request.params);
    return ok(reply, await services.channels.get(channelId, baseOf(request)));
  });
}
