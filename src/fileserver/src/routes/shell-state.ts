import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { okEnvelope } from "../lib/envelope.js";
import { parseInput } from "../lib/parse-input.js";
import type { AppServices } from "../services/app-services.js";
import { ShellStatePatchSchema } from "../types/shell.js";

const IsObject = z.record(z.string(), z.unknown());

/** `GET`/`PATCH /api/shell-state` (docs/03 section 3.3): a refused patch is `422 settings.invalid`, whole. */
export function registerShellStateRoutes(app: FastifyInstance, services: AppServices): void {
  app.get("/api/shell-state", async () => okEnvelope(services.shell.get()));

  app.patch("/api/shell-state", async (request) => {
    const body = parseInput(IsObject, request.body);
    const patch = parseInput(ShellStatePatchSchema, body, { code: "settings.invalid", status: 422 });
    return okEnvelope(services.shell.patch(patch));
  });
}
