import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { okEnvelope } from "../lib/envelope.js";
import { parseInput } from "../lib/parse-input.js";
import type { AppServices } from "../services/app-services.js";
import { refuseWritesWhenClosed } from "./writes-closed.js";

/** A JSON object whose rows the service validates one by one. */
const PatchBody = z.record(z.string(), z.unknown());

/** `GET`/`PATCH /api/settings` (docs/03 section 3.2). */
export function registerSettingsRoutes(app: FastifyInstance, services: AppServices): void {
  refuseWritesWhenClosed(app, "/api/settings");
  app.get("/api/settings", async () => okEnvelope(services.settings.get()));

  app.patch("/api/settings", async (request) => {
    const body = parseInput(PatchBody, request.body);
    return okEnvelope(services.settings.patch(body));
  });
}
