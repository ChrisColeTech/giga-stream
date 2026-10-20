import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { okEnvelope } from "../lib/envelope.js";
import { parseInput } from "../lib/parse-input.js";
import type { AppServices } from "../services/app-services.js";
import type { WatchPass } from "../services/watch-pass-service.js";
import { fail } from "./envelope.js";
import { refuseWritesWhenClosed } from "./writes-closed.js";

/** Longest id or playback id accepted; real ones are a few dozen characters. */
const ID_MAX = 200;

/** `PUT /api/watch` (docs/03 section 3.13); structurally validated here, ordered by the service. Positions are
 *  integer milliseconds (docs/01 section 8), so a float or a negative number is a malformed request. */
const WriteBody = z
  .object({
    item: z.object({ kind: z.enum(["title", "local"]), id: z.string().min(1).max(ID_MAX) }),
    season: z.number().int().positive().optional(),
    episode: z.number().int().positive().optional(),
    positionMs: z.number().int().nonnegative(),
    durationMs: z.number().int().positive().optional(),
    playbackId: z.string().min(1).max(ID_MAX),
    seq: z.number().int().positive(),
  })
  .passthrough();

const IdParams = z.object({ watchId: z.string() });

/** The marker the desktop page sends from `pocHost` (docs/63 section 3.2); only that window has it. */
const isElectron = (request: FastifyRequest): boolean => request.headers["x-giga-runtime"] === "electron";

/** A browser write without the account's bearer — the one refusal it earns (docs/63 section 3.2). */
const NO_BEARER = fail("auth.unauthorized", "Sign in to keep history.");

/** Watch history: a progress write, one entry removed, or the whole history cleared. */
export function registerWatchRoutes(app: FastifyInstance, services: AppServices, pass: WatchPass): void {
  refuseWritesWhenClosed(app, "/api/watch");

  /**
   * The fork of docs/63 section 3.2 (docs/03's amended watch rows): the frontend keeps its one contract —
   * every write, removal and clear goes to `/api/watch` — and this fileserver decides where it lands. The
   * Electron window's request writes the local store exactly as always (`local` runs only then). Anything
   * else is a browser: it must carry the account's bearer, and the identical verb, body and path tail pass
   * to the backend's `/api/account/watch` with the header intact, the backend's envelope answer returned
   * verbatim; the pass maps a transport failure to the standard unreachable envelope.
   */
  async function land(
    request: FastifyRequest,
    reply: FastifyReply,
    local: () => unknown,
    passed: { method: "PUT" | "DELETE"; tail: string; body?: unknown },
  ): Promise<unknown> {
    if (isElectron(request)) return local();
    const authorization = request.headers.authorization;
    if (authorization === undefined) return reply.code(401).send(NO_BEARER);
    const answer = await pass.forward({ ...passed, authorization });
    return reply.code(answer.status).send(answer.envelope);
  }

  app.put("/api/watch", async (request, reply) => {
    const body = parseInput(WriteBody, request.body);
    return land(request, reply, () => okEnvelope(services.watches.write(body)), { method: "PUT", tail: "", body });
  });

  app.delete("/api/watch/:watchId", async (request, reply) => {
    const { watchId } = parseInput(IdParams, request.params);
    return land(request, reply, () => okEnvelope(services.watches.drop(watchId)), {
      method: "DELETE",
      tail: `/${encodeURIComponent(watchId)}`,
    });
  });

  app.delete("/api/watch", async (request, reply) =>
    land(request, reply, () => okEnvelope(services.watches.clear()), { method: "DELETE", tail: "" }),
  );
}
