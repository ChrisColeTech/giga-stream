import type { FastifyInstance } from "fastify";

import { config } from "../config.js";

/** `GET /healthz` (docs/03 section 3.1). The backend half arrives with the live view in phase 2. */
export function registerHealth(app: FastifyInstance): void {
  app.get("/healthz", async () => ({ role: "fileserver", version: config.version, backend: "down" }));
}
