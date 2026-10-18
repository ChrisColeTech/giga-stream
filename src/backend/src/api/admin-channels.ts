import type { FastifyInstance } from "fastify";

import { ERRORS } from "../constants/errors.js";
import type { Services } from "../services/service-registry.js";
import { AdminChannelQuerySchema } from "../types/channel-query.js";
import { ok } from "./envelope.js";
import { signedIn } from "./guard.js";
import { parseInput } from "./parse-input.js";
import { baseOf } from "./request-base.js";

/**
 * The admin's full view of the channels (docs/26 section 3.3): both kinds, and for a live row its settings,
 * source, state, problem, renditions, playlist, now playing and fault. It carries local paths, so it needs an
 * signed-in admin and is never cached (`network-policy.ts`). `limit` pages it, with search, filters and a sort
 * (docs/41 section 3.1); without `limit` it is the whole list, as before.
 */
export function registerAdminChannels(app: FastifyInstance, services: Services): void {
  app.get("/api/admin-channels", async (request, reply) => {
    signedIn(services, request);
    const query = parseInput(AdminChannelQuerySchema, request.query, ERRORS.requestInvalid);
    return ok(reply, services.channels.listAdmin(baseOf(request), query.limit === undefined ? undefined : query));
  });
}
