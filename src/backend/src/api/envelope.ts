import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";

import { AppError, ERRORS } from "../constants/errors.js";
import type { ErrorEnvelope, SuccessEnvelope } from "../types/envelope.js";

/** Success in the standard envelope (docs/03 section 2). Creation is 201. */
export function ok<T>(reply: FastifyReply, data: T, status = 200): FastifyReply {
  const body: SuccessEnvelope<T> = { ok: true, data };
  return reply.code(status).send(body);
}

/** Failure in the standard envelope. */
export function fail(reply: FastifyReply, status: number, error: ErrorEnvelope["error"]): FastifyReply {
  const body: ErrorEnvelope = { ok: false, error };
  return reply.code(status).send(body);
}

function statusOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return undefined;
  return typeof error.statusCode === "number" ? error.statusCode : undefined;
}

/**
 * The only place errors become responses: a refusal a service raised keeps its code and sentence; a
 * client mistake Fastify caught (bad JSON, oversize body) is `request.invalid`; anything else is
 * `internal.failure` with a correlation id, the real exception going only to the log.
 */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return fail(reply, error.status, {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      });
    }
    const status = statusOf(error);
    if (status !== undefined && status >= 400 && status < 500) {
      return fail(reply, ERRORS.requestInvalid.status, {
        code: ERRORS.requestInvalid.code,
        message: ERRORS.requestInvalid.message,
      });
    }
    const correlationId = randomUUID();
    request.log.error({ err: error, correlationId }, "unexpected failure");
    return fail(reply, ERRORS.internalFailure.status, {
      code: ERRORS.internalFailure.code,
      message: ERRORS.internalFailure.message,
      correlationId,
    });
  });

  app.setNotFoundHandler((_request, reply) =>
    fail(reply, ERRORS.routeNotFound.status, { code: ERRORS.routeNotFound.code, message: ERRORS.routeNotFound.message }),
  );
}
