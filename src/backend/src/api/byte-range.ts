import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError, ERRORS } from "../constants/errors.js";
import type { MediaAnswer } from "../live/engine/stream-service.js";

type Range = { start: number; end: number } | "unsatisfiable" | null;

/** One byte range of a body of `size` bytes: null for none (send everything), else inclusive bounds. */
export function parseRange(header: unknown, size: number): Range {
  const match = /^bytes=(\d*)-(\d*)$/.exec(typeof header === "string" ? header.trim() : "");
  if (!match || (match[1] === "" && match[2] === "")) return null;
  let start: number;
  let end: number;
  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (suffix === 0) return "unsatisfiable";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  return start >= size || start > end ? "unsatisfiable" : { start, end };
}

/** Sends stream bytes (not the envelope) with Range: 206 with the slice, or 416 outside the body. */
export function sendMedia(request: FastifyRequest, reply: FastifyReply, answer: MediaAnswer): FastifyReply {
  const { body } = answer;
  reply.header("content-type", answer.contentType).header("cache-control", answer.cacheControl).header("accept-ranges", "bytes");
  const range = parseRange(request.headers.range, body.length);
  if (range === "unsatisfiable") {
    reply.header("content-range", `bytes */${body.length}`);
    throw new AppError(ERRORS.rangeUnsatisfiable);
  }
  if (range === null) return reply.code(200).send(body);
  reply.header("content-range", `bytes ${range.start}-${range.end}/${body.length}`);
  return reply.code(206).send(body.subarray(range.start, range.end + 1));
}
