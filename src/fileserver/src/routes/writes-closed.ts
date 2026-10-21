import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { config } from "../config.js";
import { fail } from "./envelope.js";

/** The verbs that change the one shared store; a GET never does (docs/62 wave 0). */
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** The refusal's one truthful sentence, fit for the statusbar like every message (docs/03 section 2). */
const CLOSED_MESSAGE =
  "Writes to the shared settings, favorites, collections and watch history are closed on this deployment.";

/**
 * Wave 0 of the accounts plan (docs/62): the public deployment serves unauthenticated write routes
 * over ONE shared store, so with `REQUIRE_ACCOUNT_WRITES` set it refuses every write verb on the
 * settings, favorites, collections and watch families with the standard envelope, `403 writes.closed`,
 * while every read keeps answering. One mechanism, attached where each family registers its routes:
 * the hook is added before that family's routes exist and refuses only what its prefix matches, so
 * no route body changes and no other family is ever consulted. Desktops never set the flag and
 * register nothing, so their local writes keep working exactly as today.
 */
export function refuseWritesWhenClosed(app: FastifyInstance, family: string): void {
  if (!config.requireAccountWrites) return;
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!WRITE_METHODS.has(request.method)) return;
    // The path without its query, named the way the one error handler names a path.
    const pathName = request.url.split("?")[0] ?? "";
    if (!pathName.startsWith(family)) return;
    await reply.code(403).send(fail("writes.closed", CLOSED_MESSAGE));
  });
}
