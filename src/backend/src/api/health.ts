import type { FastifyInstance } from "fastify";

import type { Services } from "../services/service-registry.js";
import { ok } from "./envelope.js";

/** `GET /healthz` (docs/03 section 7.1): role, version, the current revision and whether TMDB is set up. */
export function registerHealth(app: FastifyInstance, services: Services): void {
  app.get("/healthz", async (_request, reply) => ok(reply, services.health()));
}
