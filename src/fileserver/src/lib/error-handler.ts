import type { FastifyInstance, FastifyError, FastifyReply } from "fastify";

import { AppError } from "./app-error.js";
import { errorEnvelope, newCorrelationId } from "./envelope.js";
import type { AppErrorCode } from "../types/envelope.js";

/**
 * The one error handler (`03` section 2): an `AppError` maps to its own code, status and sentence;
 * anything else is `internal.failure` with a correlation id, logged with the real exception and
 * never showing it to a client.
 */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | AppError | Error, request, reply: FastifyReply) => {
    if (error instanceof AppError) {
      reply.code(error.status).send(errorEnvelope(error.code, error.message, { details: error.details }));
      return;
    }
    const badBody = (error as FastifyError).validation;
    if (badBody !== undefined) {
      reply.code(400).send(errorEnvelope("request.invalid", "That request was not understood."));
      return;
    }
    const correlationId = newCorrelationId();
    request.log.error({ err: error, correlationId }, "unexpected failure");
    reply
      .code(500)
      .send(
        errorEnvelope("internal.failure" as AppErrorCode, "Something went wrong on the server.", {
          correlationId,
        }),
      );
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send(errorEnvelope("route.not_found", "There is nothing at that address.")),
  );
}
