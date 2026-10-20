import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { okEnvelope } from "../lib/envelope.js";
import { parseInput } from "../lib/parse-input.js";
import type { AppServices } from "../services/app-services.js";
import { refuseWritesWhenClosed } from "./writes-closed.js";

/** Longest id or playback id accepted; real ones are a few dozen characters. */
const ID_MAX = 200;

/** `PUT /api/watch` (docs/03 section 3.13); structurally validated here, ordered by the service. Positions are
 *  integer milliseconds (docs/01 section 8), so a float or a negative number is a malformed request. */
const WriteBody = z
  .object({
    item: z.object({ kind: z.enum(["title", "local"]), id: z.string().min(1).max(ID_MAX) }),
    season: z.number().int().positive().optional(),
    episode: z.number().int().positive().optional(),
    positionMs: z.number().int().nonnegative(),
    durationMs: z.number().int().positive().optional(),
    playbackId: z.string().min(1).max(ID_MAX),
    seq: z.number().int().positive(),
  })
  .passthrough();

const IdParams = z.object({ watchId: z.string() });

/** Watch history: a progress write, one entry removed, or the whole history cleared. */
export function registerWatchRoutes(app: FastifyInstance, services: AppServices): void {
  refuseWritesWhenClosed(app, "/api/watch");
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
