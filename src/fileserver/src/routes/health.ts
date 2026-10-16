import type { FastifyInstance } from "fastify";

import { pingDatabase } from "../store/database.js";
import { okEnvelope } from "../lib/envelope.js";
import { APP_ROLE, APP_VERSION } from "../constants/deployment.js";
import type { AppServices } from "../services/app-services.js";

/** `GET /healthz` (docs/03 section 3.1): the fileserver's own state and its view of the backend. */
export function registerHealth(app: FastifyInstance, services: AppServices): void {
  app.get("/healthz", async () => {
    pingDatabase(services.database);
    const backend = services.live.backend();
    return okEnvelope({
      role: APP_ROLE,
      version: APP_VERSION,
      backend: backend.connected ? "up" : "down",
      ...(backend.readAt !== undefined && { readAt: backend.readAt }),
    });
  });
}
