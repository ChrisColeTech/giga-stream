import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { okEnvelope } from "../lib/envelope.js";
import { parseInput } from "../lib/parse-input.js";
import type { AppServices } from "../services/app-services.js";

const IdParams = z.object({ jobId: z.string() });

/** Jobs: the list, a cancel (`202` with the job in `cancelling`), and dismissing settled ones (3.9). */
export function registerJobsRoutes(app: FastifyInstance, services: AppServices): void {
  app.get("/api/jobs", async () => okEnvelope(services.jobs.list()));

  app.post("/api/jobs/:jobId/cancel", async (request, reply) => {
    const params = parseInput(IdParams, request.params);
    reply.code(202);
    return okEnvelope(services.jobs.cancel(params.jobId));
  });

  app.delete("/api/jobs/:jobId", async (request) => {
    const params = parseInput(IdParams, request.params);
    return okEnvelope(services.jobs.dismiss(params.jobId));
  });
}
