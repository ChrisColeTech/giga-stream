import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { AppError, ERRORS } from "../constants/errors.ts";
import type { MediaAnswer } from "../services/stream-service.ts";
import type { Services } from "../services/service-registry.ts";
import { parseInput } from "./parse-input.ts";

const RAW_TRAVERSAL = /\.\.|%2e|%2f|%5c|\\|\0|%00/i;
const LiveParams = z.object({ channelId: z.string().regex(/^[a-z0-9-]{1,64}$/), "*": z.string().max(200) });
const LogoParams = z.object({ file: z.string().regex(/^[a-z0-9-]{1,64}\.png$/) });

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

/** Sends stream bytes with Range: 206 with the slice, or 416 outside the body. */
function sendMedia(request: FastifyRequest, reply: FastifyReply, answer: MediaAnswer): FastifyReply {
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

/**
 * The stream itself, at the addresses a player loads (docs/10 section 3.1): playlists and segments under
 * `/live/:channelId/`, logos under `/logos/`, and the test page. These are media, not the API, so they sit
 * outside `/api`; an error is still the envelope.
 */
export function registerMedia(app: FastifyInstance, services: Services, testPage: string | null): void {
  app.get("/live/:channelId/*", async (request, reply) => {
    if (RAW_TRAVERSAL.test((request.raw.url ?? "").split("?")[0] ?? "")) throw new AppError(ERRORS.pathInvalid);
    const params = parseInput(LiveParams, request.params, ERRORS.pathInvalid);
    const answer = await services.stream.read(params.channelId, params["*"].split("/"));
    return sendMedia(request, reply, answer);
  });

  app.get("/logos/:file", async (request, reply) => {
    const { file } = parseInput(LogoParams, request.params, ERRORS.pathInvalid);
    return sendMedia(request, reply, services.stream.logo(file.slice(0, -".png".length)));
  });

  if (testPage !== null) {
    app.get("/test/player.html", async (_request, reply) =>
      reply.header("content-type", "text/html; charset=utf-8").header("cache-control", "no-store").send(testPage));
  }
}
