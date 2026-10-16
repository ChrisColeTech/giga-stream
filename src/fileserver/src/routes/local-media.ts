import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { okEnvelope } from "../lib/envelope.js";
import { parseInput } from "../lib/parse-input.js";
import type { AppServices } from "../services/app-services.js";

const IdParams = z.object({ localFileId: z.string() });
const RangeHeaders = z.object({ range: z.string().optional(), "if-range": z.string().optional() });

/** Local media (docs/03 section 3.10): one full answer or one byte range, and the Player's details. */
export function registerLocalMediaRoutes(app: FastifyInstance, services: AppServices): void {
  app.route({
    method: ["GET", "HEAD"],
    url: "/api/media/local/:localFileId",
    handler: async (request, reply) => {
      const { localFileId } = parseInput(IdParams, request.params);
      const headers = parseInput(RangeHeaders, request.headers);
      // `plan` throws 404/416 before any hijack, so the error handler still answers whole (3.10).
      const plan = services.media.plan(localFileId, { range: headers.range, ifRange: headers["if-range"] });
      reply.hijack();
      await serve(services.media, plan, request.method === "HEAD", reply.raw);
    },
  });

  app.get("/api/media/local/:localFileId/info", async (request) => {
    const { localFileId } = parseInput(IdParams, request.params);
    return okEnvelope(services.media.info(localFileId));
  });
}

/** The raw byte level: head already validated, and an abandoned request stops reading. */
async function serve(
  media: AppServices["media"],
  plan: ReturnType<AppServices["media"]["plan"]>,
  head: boolean,
  raw: FastifyReply["raw"],
): Promise<void> {
  try {
    await media.serve(plan, head, raw);
  } catch {
    raw.destroy();
  }
}
