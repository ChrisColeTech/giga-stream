import type { FastifyRequest } from "fastify";

import { AppError, ERRORS } from "../constants/errors.ts";

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/**
 * Changes (channel CRUD, faults) are accepted only from this computer, by the TCP peer itself (never a
 * forwarded header): the server may serve its streams to the LAN, but nobody on it can change them.
 */
export function fromThisComputer(request: FastifyRequest): void {
  if (!LOOPBACK.has(request.socket.remoteAddress ?? "")) throw new AppError(ERRORS.loopbackOnly);
}

/** The address the caller used, so answers carry stream addresses that work from where they asked. */
export function baseOf(request: FastifyRequest): string {
  return `${request.protocol}://${request.headers.host ?? "127.0.0.1"}`;
}
