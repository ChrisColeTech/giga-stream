import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { AppError } from "../lib/app-error.js";
import { errorEnvelope, okEnvelope } from "../lib/envelope.js";
import { parseInput } from "../lib/parse-input.js";
import type { AppServices } from "../services/app-services.js";

const IdParams = z.object({ imageId: z.string() });

/**
 * The image cache route (docs/03 section 3.11). `serve` works at the raw-reply level: id shape,
 * file presence and a fetch-on-miss all resolve there, and any refusal still answers the standard
 * error envelope, because a hijacked request never reaches the error handler.
 */
export function registerImagesRoutes(app: FastifyInstance, services: AppServices): void {
  app.route({
    method: ["GET", "HEAD"],
    url: "/api/images/:imageId",
    handler: async (request, reply) => {
      const { imageId } = parseInput(IdParams, request.params);
      reply.hijack();
      const raw = reply.raw;
      try {
        await services.images.serve(imageId, request.method === "HEAD", raw);
      } catch (error) {
        const appError =
          error instanceof AppError
            ? error
            : new AppError("internal.failure", 500, "Something went wrong on the server.");
        raw.statusCode = appError.status;
        raw.setHeader("content-type", "application/json; charset=utf-8");
        raw.end(JSON.stringify(errorEnvelope(appError.code, appError.message, { details: appError.details })));
      }
    },
  });
}
