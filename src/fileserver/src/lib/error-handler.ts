import { createReadStream } from "node:fs";

import type { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "./app-error.js";
import { errorEnvelope, newCorrelationId } from "./envelope.js";
import type { AppErrorCode } from "../types/envelope.js";

/** Addresses the envelope always owes (docs/01: every route begins /api; /healthz is root-level). */
function isApiOrHealth(pathName: string): boolean {
  return (
    pathName === "/api" ||
    pathName.startsWith("/api/") ||
    pathName === "/healthz" ||
    pathName.startsWith("/healthz/")
  );
}

/**
 * The one error handler (`03` section 2): an `AppError` maps to its own code, status and sentence;
 * anything else is `internal.failure` with a correlation id, logged with the real exception and
 * never showing it to a client. `spaEntry`, when given, answers a deep link with the built
 * interface's index.html (22 section 5.2); `/api` and `/healthz` addresses, and every non-GET,
 * keep the JSON 404 envelope.
 */
export function registerErrorHandling(
  app: FastifyInstance,
  spaEntry?: (pathName: string) => string | undefined,
): void {
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

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    const pathName = request.url.split("?")[0] ?? "";
    const entry =
      request.method === "GET" && !isApiOrHealth(pathName) ? spaEntry?.(pathName) : undefined;
    if (entry !== undefined) {
      reply.type("text/html").send(createReadStream(entry));
      return;
    }
    reply.code(404).send(errorEnvelope("route.not_found", "There is nothing at that address."));
  });
}
