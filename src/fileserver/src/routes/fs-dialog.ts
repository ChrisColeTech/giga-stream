import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { okEnvelope } from "../lib/envelope.js";
import { parseInput } from "../lib/parse-input.js";
import type { AppServices } from "../services/app-services.js";

/** `{ name }` only exists with `TEST_FOLDER_ROOT`; the Electron lane needs no body at all (3.8). */
const Body = z.object({ name: z.unknown() }).passthrough();

/** `POST /api/fs/dialog`: the folder picker, or a `{ name }` under the test root (docs/03 section 3.8). */
export function registerFsDialogRoutes(app: FastifyInstance, services: AppServices): void {
  app.post("/api/fs/dialog", async (request) => {
    const body = parseInput(Body, request.body ?? {});
    return okEnvelope(await services.dialog.selectFolder(body.name));
  });
}
