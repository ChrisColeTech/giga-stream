import type { FastifyRequest } from "fastify";

/**
 * The address the caller used (scheme and host, honouring a trusted proxy's forwarded headers), so a live
 * channel's stream and logo addresses in an answer work from where it was asked (docs/26 decision D3).
 */
export const baseOf = (request: FastifyRequest): string => `${request.protocol}://${request.host}`;
