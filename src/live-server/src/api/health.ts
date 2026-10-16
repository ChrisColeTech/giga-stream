import type { FastifyInstance } from "fastify";

import type { Services } from "../services/service-registry.ts";
import { ok } from "./envelope.ts";

/** `GET /healthz`: role and channel count. */
export function registerHealth(app: FastifyInstance, services: Services): void {
  app.get("/healthz", async (_request, reply) => ok(reply, services.health()));
}
