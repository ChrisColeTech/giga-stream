import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { okEnvelope } from "../lib/envelope.js";
import { parseInput } from "../lib/parse-input.js";
import type { AppServices } from "../services/app-services.js";

/** `PUT /api/watch` (docs/03 section 3.13); structurally validated here, ordered by the service. */
const WriteBody = z
  .object({
    item: z.object({ kind: z.enum(["title", "local"]), id: z.string() }),
    season: z.number().optional(),
    episode: z.number().optional(),
    positionMs: z.number(),
    durationMs: z.number().optional(),
    playbackId: z.string(),
    seq: z.number(),
  })
  .passthrough();

const IdParams = z.object({ watchId: z.string() });

/** Watch history: a progress write, one entry removed, or the whole history cleared. */
export function registerWatchRoutes(app: FastifyInstance, services: AppServices): void {
  app.put("/api/watch", async (request) => {
    const body = parseInput(WriteBody, request.body);
    return okEnvelope(services.watches.write(body));
  });

  app.delete("/api/watch/:watchId", async (request) => {
    const { watchId } = parseInput(IdParams, request.params);
    return okEnvelope(services.watches.drop(watchId));
  });

  app.delete("/api/watch", async () => okEnvelope(services.watches.clear()));
}
