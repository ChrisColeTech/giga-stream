import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { okEnvelope } from "../lib/envelope.js";
import { parseInput } from "../lib/parse-input.js";
import type { AppServices } from "../services/app-services.js";
import type { Principal } from "../types/account.js";
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

/** Watch history: a progress write, one entry removed, or the whole history cleared. */
export function registerWatchRoutes(app: FastifyInstance, services: AppServices): void {
  refuseWritesWhenClosed(app, "/api/watch");

  /**
   * The fork of docs/63 section 3.2 (docs/03's amended watch rows): the frontend keeps its one contract —
   * every write, removal and clear goes to `/api/watch` — and this fileserver decides where it lands. The
   * Electron window's request writes the local store exactly as always (`local` runs only then). Anything
   * else is a browser: it must carry the account's bearer, and the account service writes the Turso row
   * directly. Both branches preserve the same answer shape.
   */
  async function land(
    request: FastifyRequest,
    local: () => unknown,
    account: (principal: Principal) => Promise<unknown>,
  ): Promise<unknown> {
    if (isElectron(request)) return local();
    const authorization = request.headers.authorization;
    const principal = await services.accountAuth.authenticate(authorization);
    return account(principal);
  }

  app.put("/api/watch", async (request) => {
    const body = parseInput(WriteBody, request.body);
    return land(request, () => okEnvelope(services.watches.write(body)), async (principal) => {
      return okEnvelope(await services.accountData.writeWatch(principal, body));
    });
  });

  app.delete("/api/watch/:watchId", async (request) => {
    const { watchId } = parseInput(IdParams, request.params);
    return land(request, () => okEnvelope(services.watches.drop(watchId)), async (principal) => {
      return okEnvelope(await services.accountData.dropWatch(principal, watchId));
    });
  });

  app.delete("/api/watch", async (request) =>
    land(request, () => okEnvelope(services.watches.clear()), async (principal) => {
      return okEnvelope(await services.accountData.clearWatch(principal));
    }),
  );
}
