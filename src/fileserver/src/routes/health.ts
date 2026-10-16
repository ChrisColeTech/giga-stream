import type { FastifyInstance } from "fastify";

import { okEnvelope } from "../lib/envelope.js";
import type { AppServices } from "../services/app-services.js";

/** `GET /healthz` (docs/03 section 3.1): the fileserver's own state and its view of the backend. */
export function registerHealth(app: FastifyInstance, services: AppServices): void {
  app.get("/healthz", async () => okEnvelope(services.health()));
}
