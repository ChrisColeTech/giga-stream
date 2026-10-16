import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { PocResultsService } from "../services/poc-results-service.js";
import { fail, ok } from "./envelope.js";

/** A result as the proof of concept's page sends it; everything beyond the two names is kept as sent. */
const ResultSchema = z.object({ providerId: z.string().min(1), runtime: z.string().min(1) }).passthrough();

/** `POST /api/poc/results`: the proof of concept's Save result (docs/14). Not part of the product. */
export function registerPocResults(app: FastifyInstance, results: PocResultsService): void {
  app.post("/api/poc/results", async (request, reply) => {
    const parsed = ResultSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(fail("request.invalid", "That result could not be read."));
    return ok(await results.save(parsed.data.providerId, parsed.data.runtime, parsed.data));
  });
}
