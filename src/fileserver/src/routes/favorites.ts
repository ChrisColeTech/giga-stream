import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { okEnvelope } from "../lib/envelope.js";
import { parseInput } from "../lib/parse-input.js";
import type { AppServices } from "../services/app-services.js";

const RefParams = z.object({ kind: z.enum(["title", "local"]), itemId: z.string() });

/** Favorites: both routes are idempotent and answer `{ ref, favorite }` (docs/03 section 3.12). */
export function registerFavoritesRoutes(app: FastifyInstance, services: AppServices): void {
  app.put("/api/favorites/:kind/:itemId", async (request) => {
    const { kind, itemId } = parseInput(RefParams, request.params);
    return okEnvelope(services.favorites.set(kind, itemId, true));
  });

  app.delete("/api/favorites/:kind/:itemId", async (request) => {
    const { kind, itemId } = parseInput(RefParams, request.params);
    return okEnvelope(services.favorites.set(kind, itemId, false));
  });
}
