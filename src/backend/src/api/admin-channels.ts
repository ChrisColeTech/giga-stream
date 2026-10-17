import type { FastifyInstance } from "fastify";

import type { Services } from "../services/service-registry.js";
import { ok } from "./envelope.js";
import { signedIn } from "./guard.js";
import { baseOf } from "./request-base.js";

/**
 * The admin's full view of the channels (docs/26 section 3.3): both kinds, and for a live row its settings,
 * source, state, problem, renditions, playlist, now playing and fault. It carries local paths, so it needs an
 * signed-in admin and is never cached (`network-policy.ts`).
 */
export function registerAdminChannels(app: FastifyInstance, services: Services): void {
  app.get("/api/admin-channels", async (request, reply) => {
    signedIn(services, request);
    return ok(reply, services.channels.listAdmin(baseOf(request)));
  });
}
